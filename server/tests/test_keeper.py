from destiny.keeper import tick

from .fakes import FakeChain


def test_does_nothing_when_nothing_is_due():
    chain = FakeChain(now=1_000, next_cutoff=2_000)
    chain.add_ticket(1, due=1_500)
    assert tick(chain) == []
    assert chain.log == []


def test_settles_only_tickets_past_their_due_date():
    chain = FakeChain(now=1_000)
    chain.add_ticket(1, due=999)
    chain.add_ticket(2, due=1_000)  # exactly at the due date is not past it
    chain.add_ticket(3, due=1_001)
    tick(chain)
    assert chain.log == [("settle", 1)]


def test_runs_the_cutoff_when_due_and_after_settlements():
    chain = FakeChain(now=3_000, next_cutoff=3_000)
    chain.add_ticket(1, due=2_000)
    tick(chain)
    assert chain.log == [("settle", 1), ("cutoff",)]


def test_one_failed_settlement_does_not_stop_the_others():
    chain = FakeChain(now=5_000, next_cutoff=5_000)
    chain.add_ticket(1, due=1)
    chain.add_ticket(2, due=1)
    chain.fail_settle.add(1)
    actions = tick(chain)
    assert chain.log == [("settle", 2), ("cutoff",)]
    assert actions[0]["error"] == "Too little received"


def test_a_failed_cutoff_is_reported_not_raised():
    chain = FakeChain(now=5_000, next_cutoff=5_000)
    chain.fail_cutoff = True
    assert tick(chain) == [{"action": "cutoff", "error": "StalePrice"}]


def test_already_ended_tickets_are_ignored():
    chain = FakeChain(now=5_000, next_cutoff=9_000)
    chain.add_ticket(1, due=1, status="closed")
    assert tick(chain) == []
