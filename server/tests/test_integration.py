"""End to end against a local anvil node: deploy, deposit, cut-off, open a ticket,
let it fall due, and have the keeper settle it. Skipped when Foundry is not installed."""
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
USDC = 10**6

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
        )
        yield w3
    finally:
        anvil.terminate()


def travel(w3, seconds):
    w3.provider.make_request("evm_increaseTime", [seconds])
    w3.provider.make_request("evm_mine", [])


def test_full_term_mode_lifecycle(node, tmp_path):
    w3 = node
    addresses = json.loads((ROOT / "deployments" / "local.json").read_text())
    config = Config(rpc_url=RPC, addresses=addresses, keeper_key=KEY, db_path=str(tmp_path / "e2e.sqlite"), poll_seconds=1)
    chain = Chain(config)
    me = chain.account.address
    usdc = w3.eth.contract(address=addresses["usdc"], abi=load_abi("MockERC20"))

    def send(fn):
        return chain._send(fn)

    # Deposit 100,000 USDC and wait for the weekly cut-off.
    send(usdc.functions.approve(addresses["vault"], 2**256 - 1))
    send(usdc.functions.approve(addresses["desk"], 2**256 - 1))
    send(chain.vault.functions.requestDeposit(100_000 * USDC))
    assert tick(chain) == []  # nothing is due yet
    travel(w3, 7 * 86_400)
    assert [a["action"] for a in tick(chain)] == ["cutoff"]
    send(chain.vault.functions.claimDeposit(me))
    assert chain.vault.functions.balanceOf(me).call() == 100_000 * USDC

    # Open the design's example ticket: 1,000 down on BTC at 3x for 14 days.
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
