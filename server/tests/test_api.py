from fastapi.testclient import TestClient

from destiny.api import create_app
from destiny.indexer import Indexer

from .fakes import FakeChain

USDC = 10**6


def client(tmp_path, chain=None):
    chain = chain or FakeChain()
    return TestClient(create_app(chain, Indexer(str(tmp_path / "t.sqlite")))), chain


def test_health_and_bucket(tmp_path):
    c, _ = client(tmp_path)
    assert c.get("/health").json()["ok"] is True
    assert c.get("/bucket").json()["nav"] == 100_000


def test_fund_and_sale_figures(tmp_path):
    c, _ = client(tmp_path)
    assert c.get("/fund").json()["totalStaked"] == 10_000 * 10**18
    assert c.get("/sale").json()["open"] is True


def test_fund_and_sale_are_404_without_the_token_side(tmp_path):
    c, _ = client(tmp_path, FakeChain(token_side=False))
    assert c.get("/fund").status_code == 404
    assert c.get("/sale").status_code == 404
    assert c.get("/bucket").status_code == 200


def test_tickets_can_be_filtered_by_owner(tmp_path):
    chain = FakeChain()
    chain.add_ticket(1, due=1_500, owner="0xAAA")
    chain.add_ticket(2, due=1_500, owner="0xBBB")
    c, _ = client(tmp_path, chain)
    assert len(c.get("/tickets").json()) == 2
    assert [t["id"] for t in c.get("/tickets", params={"owner": "0xaaa"}).json()] == [1]
    assert c.get("/tickets/2").json()["owner"] == "0xBBB"
    assert c.get("/tickets/9").status_code == 404


def test_points_come_from_indexed_events_and_indexing_is_idempotent(tmp_path):
    chain = FakeChain()
    chain._events = [{"block": 5, "index": 0, "name": "Paid", "args": {"id": 1, "owner": "0xAAA", "principal": 0, "markup": 3 * USDC}}]
    c, _ = client(tmp_path, chain)
    assert c.get("/points/0xAAA").json()["trading"] == 3.0
    assert c.get("/points/0xAAA").json()["trading"] == 3.0  # second sync adds nothing
    assert c.get("/points/0xnobody").json()["total"] == 0.0
    assert c.get("/points").json()["0xaaa"]["total"] == 3.0


def test_indexer_keeps_big_integers_exact(tmp_path):
    chain = FakeChain()
    big = 123_456_789_012_345_678_901_234_567_890
    chain._events = [{"block": 1, "index": 0, "name": "Cutoff", "args": {"epoch": 1, "price": big}}]
    indexer = Indexer(str(tmp_path / "i.sqlite"))
    assert indexer.sync(chain) == 1
    assert indexer.sync(chain) == 0
    assert indexer.events()[0]["args"]["price"] == big
