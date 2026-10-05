"""End to end against a local anvil node: deploy, deposit, cut-off, open a ticket,
let it fall due, and have the keeper settle it; then a profitable close that feeds
the staking fund, a stake, and a reserve sale. Skipped when Foundry is not installed."""
import json
import os
import pathlib
import shutil
import subprocess
import time

import pytest
from web3 import Web3

from destiny.chain import Chain
from destiny.config import Config, load_abi
from destiny.indexer import Indexer
from destiny.keeper import tick
from destiny.points import all_points

ROOT = pathlib.Path(__file__).resolve().parents[2]
FOUNDRY = pathlib.Path.home() / ".foundry" / "bin"
os.environ["PATH"] = f"{FOUNDRY}:{os.environ['PATH']}"
KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"  # anvil's first test key
RPC = "http://127.0.0.1:8546"
DEPLOYMENT = ROOT / "deployments" / "pytest.json"
USDC = 10**6
SCR = 10**18

pytestmark = pytest.mark.skipif(shutil.which("anvil") is None, reason="Foundry (anvil) is not installed")


@pytest.fixture(scope="module")
def node():
    anvil = subprocess.Popen(["anvil", "--port", "8546", "--silent"])
    try:
        w3 = Web3(Web3.HTTPProvider(RPC))
        for _ in range(50):
            if w3.is_connected():
                break
            time.sleep(0.1)
        subprocess.run(
            ["forge", "script", "script/DeployLocal.s.sol", "--rpc-url", RPC, "--broadcast"],
            cwd=ROOT / "contracts", check=True, capture_output=True,
            env={**os.environ, "DEPLOYMENT_OUT": f"../deployments/{DEPLOYMENT.name}"},
        )
        yield w3
    finally:
        anvil.terminate()
        DEPLOYMENT.unlink(missing_ok=True)


def travel(w3, seconds):
    w3.provider.make_request("evm_increaseTime", [seconds])
    w3.provider.make_request("evm_mine", [])


def test_full_lifecycle(node, tmp_path):
    w3 = node
    addresses = json.loads(DEPLOYMENT.read_text())
    config = Config(rpc_url=RPC, addresses=addresses, keeper_key=KEY, db_path=str(tmp_path / "e2e.sqlite"), poll_seconds=1)
    chain = Chain(config)
    me = chain.account.address
    erc20 = lambda key: w3.eth.contract(address=addresses[key], abi=load_abi("MockERC20"))
    usdc, scr = erc20("usdc"), erc20("token")
    feed = w3.eth.contract(address=addresses["feed"], abi=load_abi("MockFeed"))
    router = w3.eth.contract(address=addresses["router"], abi=load_abi("MockRouter"))

    def send(fn):
        return chain._send(fn)

    # ── Depositor: 100,000 USDC in, processed at the weekly cut-off ──
    for spender in ("vault", "desk", "sale"):
        send(usdc.functions.approve(addresses[spender], 2**256 - 1))
    send(chain.vault.functions.requestDeposit(100_000 * USDC))
    assert tick(chain) == []  # nothing is due yet
    travel(w3, 7 * 86_400)
    assert [a["action"] for a in tick(chain)] == ["cutoff"]
    send(chain.vault.functions.claimDeposit(me))
    assert chain.vault.functions.balanceOf(me).call() == 100_000 * USDC

    # ── Trader: the design's example ticket, 1,000 down on BTC at 3x for 14 days ──
    send(chain.desk.functions.open(1_000 * USDC, 30_000, 14 * 86_400, 0))
    ticket = chain.ticket(1)
    assert (ticket.status, ticket.financed, ticket.markup) == ("live", 2_000 * USDC, 8_438_356)
    assert chain.bucket()["lent"] == 2_000 * USDC

    # Before the due date the keeper must not touch it.
    travel(w3, 13 * 86_400)
    assert all(a["action"] != "settle" for a in tick(chain))
    assert chain.ticket(1).status == "live"

    # After the due date the keeper settles it and the vault is whole again, plus markup.
    travel(w3, 2 * 86_400)
    actions = tick(chain)
    assert actions[0]["action"] == "settle" and "tx" in actions[0]
    assert chain.ticket(1).status == "settled"
    bucket = chain.bucket()
    assert bucket["lent"] == 0
    assert bucket["idle"] + bucket["reserve"] == 100_000 * USDC + 8_438_356

    # Points follow from the events: markup paid, and USDC-days at each cut-off.
    indexer = Indexer(config.db_path)
    assert indexer.sync(chain) > 0
    points = all_points(indexer.events())[me.lower()]
    assert round(points["trading"], 6) == 8.438356
    assert points["depositing"] > 0

    # ── A profitable close: BTC up 20%, 30% of the profit reaches the staking fund ──
    assert chain.backstop()["usdcHeld"] == 0
    send(chain.desk.functions.open(1_000 * USDC, 30_000, 14 * 86_400, 0))
    send(feed.functions.set(72_000 * 10**8))
    send(router.functions.setPrice(72_000 * USDC))
    send(chain.desk.functions.close(2, 0))
    assert chain.ticket(2).status == "closed"
    fund = chain.backstop()
    assert fund["usdcHeld"] > 0 and fund["available"] > 0
    assert chain.reserve_sale()["reserveAssets"] > 0, "15% of the share went to the reserve"

    # ── Staker: SCR in, a share of the fund out, and a 14 day cooldown to leave ──
    send(scr.functions.approve(addresses["fund"], 2**256 - 1))
    send(chain.fund.functions.stake(10_000 * SCR))
    assert chain.backstop()["totalStaked"] == 10_000 * SCR
    travel(w3, 86_400)
    assert chain.fund.functions.earned(me).call() > 0
    send(chain.fund.functions.requestUnstake(10_000 * SCR))
    travel(w3, 14 * 86_400)
    send(chain.fund.functions.unstake())
    assert chain.backstop()["totalStaked"] == 0

    # ── SCR buyer: new SCR for USDC, every USDC to the reserve, delivered staked ──
    sale = chain.reserve_sale()
    assert sale["open"] and sale["reserveAssets"] < sale["reserveTarget"]
    reserve_before = sale["reserveAssets"]
    send(chain.sale.functions.buy(1_000 * SCR, 2**256 - 1))
    assert chain.fund.functions.stakeOf(me).call() == 1_000 * SCR
    assert chain.reserve_sale()["reserveAssets"] - reserve_before == 1_000 * sale["price"]  # 1,000 whole SCR

    # The API serves all of it.
    assert indexer.sync(chain) > 0
    assert {e["name"] for e in indexer.events()} >= {"Staked", "Unstaked", "Received", "Sold", "Cutoff", "Ended"}
