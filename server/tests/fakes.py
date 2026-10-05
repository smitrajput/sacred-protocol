"""An in-memory stand-in for the chain, for tests that should not need a node."""
from destiny.chain import Ticket


class FakeChain:
    def __init__(self, now=1_000, next_cutoff=2_000, token_side=True):
        self._now = now
        self._next_cutoff = next_cutoff
        self.token_side = token_side
        self.tickets = {}
        self.log = []
        self.fail_settle = set()
        self.fail_cutoff = False
        self._events = []

    def add_ticket(self, ticket_id, due, owner="0xAbC", status="live"):
        self.tickets[ticket_id] = Ticket(ticket_id, owner, status, due - 100, due, 5, 3_000, 1_000, 2_000, 8, 0, 2_008)

    def now(self):
        return self._now

    def head(self):
        return max([e["block"] for e in self._events], default=0)

    def next_cutoff(self):
        return self._next_cutoff

    def live_ids(self):
        return [i for i, t in self.tickets.items() if t.status == "live"]

    def ticket(self, ticket_id):
        return self.tickets[ticket_id]

    def ticket_count(self):
        return len(self.tickets)

    def bucket(self):
        return {"idle": 98_000, "lent": 2_000, "nav": 100_000}

    def backstop(self):
        if not self.token_side:
            return None
        return {"totalStaked": 10_000 * 10**18, "totalShares": 10_000 * 10**18, "available": 500, "usdcHeld": 700}

    def reserve_sale(self):
        if not self.token_side:
            return None
        return {"open": True, "price": 100_000, "reserveAssets": 1_000, "reserveTarget": 10_000}

    def events(self, from_block, to_block):
        return [e for e in self._events if from_block <= e["block"] <= to_block]

    def settle(self, ticket_id):
        if ticket_id in self.fail_settle:
            raise RuntimeError("Too little received")
        self.tickets[ticket_id].status = "settled"
        self.log.append(("settle", ticket_id))
        return f"0xsettle{ticket_id}"

    def cutoff(self):
        if self.fail_cutoff:
            raise RuntimeError("StalePrice")
        self._next_cutoff += 7 * 86_400
        self.log.append(("cutoff",))
        return "0xcutoff"
