"""The only module that talks to the chain. Everything else takes a Chain object,
so the keeper, the points and the API can be tested without a node."""
from dataclasses import dataclass

from web3 import Web3

from .config import Config, load_abi

STATUS = ["none", "live", "closed", "paid_off", "settled", "settled_short"]
EVENTS = {
    "desk": ["Opened", "Paid", "Ended"],
    "vault": ["DepositRequested", "DepositClaimed", "WithdrawRequested", "WithdrawClaimed", "Cutoff"],
}


@dataclass
class Ticket:
    id: int
    owner: str
    status: str
    opened: int
    due: int
    qty: int
    cost: int
    down_payment: int
    financed: int
    markup: int
    repaid: int
    settlement: int


class Chain:
    def __init__(self, config: Config):
        self.w3 = Web3(Web3.HTTPProvider(config.rpc_url))
        a = config.addresses
        self.vault = self.w3.eth.contract(address=a["vault"], abi=load_abi("Vault"))
        self.desk = self.w3.eth.contract(address=a["desk"], abi=load_abi("Desk"))
        self.account = self.w3.eth.account.from_key(config.keeper_key) if config.keeper_key else None

    # ── reads ──

    def now(self) -> int:
        return self.w3.eth.get_block("latest")["timestamp"]

    def head(self) -> int:
        return self.w3.eth.block_number

    def next_cutoff(self) -> int:
        return self.vault.functions.nextCutoff().call()

    def live_ids(self) -> list[int]:
        n = self.desk.functions.liveCount().call()
        return [self.desk.functions.liveIds(i).call() for i in range(n)]

    def ticket(self, ticket_id: int) -> Ticket:
        t = self.desk.functions.getTicket(ticket_id).call()
        live = t[1] == 1
        return Ticket(
            id=ticket_id, owner=t[0], status=STATUS[t[1]], opened=t[2], due=t[3], qty=t[4], cost=t[5],
            down_payment=t[6], financed=t[7], markup=t[8], repaid=t[9],
            settlement=self.desk.functions.settlementAmount(ticket_id).call() if live else 0,
        )

    def ticket_count(self) -> int:
        return self.desk.functions.nextId().call() - 1

    def bucket(self) -> dict:
        v = self.vault.functions
        idle, lent = v.idle().call(), v.lent().call()
        try:
            nav = v.navNow().call()
        except Exception:  # the price feed is stale
            nav = None
        return {
            "idle": idle, "lent": lent, "reserve": v.reserve().call(), "queuedDeposits": v.queuedDeposits().call(),
            "claimable": v.claimable().call(), "nav": nav, "lastPrice": v.lastPrice().call(),
            "totalShares": v.totalSupply().call(), "epoch": v.epoch().call(), "nextCutoff": v.nextCutoff().call(),
            "utilisationBps": lent * 10_000 // (idle + lent) if idle + lent else 0,
            "liveTickets": self.desk.functions.liveCount().call(),
        }

    def events(self, from_block: int, to_block: int) -> list[dict]:
        """Decoded logs of every event the indexer cares about, oldest first."""
        out = []
        for key, names in EVENTS.items():
            contract = getattr(self, key)
            for name in names:
                for log in getattr(contract.events, name)().get_logs(from_block=from_block, to_block=to_block):
                    out.append({"block": log["blockNumber"], "index": log["logIndex"], "name": name, "args": dict(log["args"])})
        return sorted(out, key=lambda e: (e["block"], e["index"]))

    # ── writes (the keeper's three jobs) ──

    def _send(self, fn) -> str:
        if self.account is None:
            raise RuntimeError("KEEPER_KEY is not set")
        tx = fn.build_transaction({
            "from": self.account.address,
            "nonce": self.w3.eth.get_transaction_count(self.account.address),
        })
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        if receipt["status"] != 1:
            raise RuntimeError(f"transaction reverted: {tx_hash.hex()}")
        return tx_hash.hex()

    def cutoff(self) -> str:
        return self._send(self.vault.functions.cutoff())

    def settle(self, ticket_id: int) -> str:
        return self._send(self.desk.functions.settle(ticket_id))
