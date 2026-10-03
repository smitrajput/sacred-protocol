from destiny.points import all_points, depositor_points, trader_points

USDC = 10**6
WAD = 10**18


def ev(name, block=1, **args):
    return {"block": block, "index": 0, "name": name, "args": args}


def test_traders_earn_one_point_per_usdc_of_markup():
    events = [
        ev("Paid", id=1, owner="0xAAA", principal=2_000 * USDC, markup=8_438_356),
        ev("Paid", id=2, owner="0xaaa", principal=500 * USDC, markup=1 * USDC),
        ev("Paid", id=3, owner="0xBBB", principal=100 * USDC, markup=0),
    ]
    points = trader_points(events)
    assert round(points["0xaaa"], 6) == 9.438356
    assert points["0xbbb"] == 0


def test_volume_and_principal_earn_nothing():
    events = [ev("Opened", id=1, owner="0xAAA", cost=3_000_000 * USDC), ev("Paid", id=1, owner="0xAAA", principal=10**12, markup=0)]
    assert trader_points(events) == {"0xaaa": 0.0}


def test_depositors_earn_usdc_days_at_each_cutoff():
    events = [
        ev("DepositClaimed", user="0xD1", shares=1_000 * USDC, refunded=0, epoch=1),
        ev("Cutoff", block=2, epoch=2, nav=0, price=WAD, depositAssets=0, withdrawAssets=0),
        ev("Cutoff", block=3, epoch=3, nav=0, price=WAD * 11 // 10, depositAssets=0, withdrawAssets=0),
    ]
    # 1,000 USDC x 7 days, then 1,100 USDC x 7 days
    assert round(depositor_points(events)["0xd1"], 6) == 7_000 + 7_700


def test_queued_withdrawals_stop_earning_and_returned_shares_resume():
    events = [
        ev("DepositClaimed", user="0xD1", shares=1_000 * USDC, refunded=0, epoch=1),
        ev("WithdrawRequested", user="0xD1", shares=1_000 * USDC, epoch=2),
        ev("Cutoff", block=2, epoch=2, nav=0, price=WAD, depositAssets=0, withdrawAssets=0),
        ev("WithdrawClaimed", user="0xD1", assets=600 * USDC, sharesReturned=400 * USDC, epoch=2),
        ev("Cutoff", block=3, epoch=3, nav=0, price=WAD, depositAssets=0, withdrawAssets=0),
    ]
    assert depositor_points(events)["0xd1"] == 400 * 7


def test_all_points_merges_both_kinds():
    events = [
        ev("Paid", id=1, owner="0xAAA", principal=0, markup=5 * USDC),
        ev("DepositClaimed", user="0xAAA", shares=10 * USDC, refunded=0, epoch=1),
        ev("Cutoff", block=2, epoch=2, nav=0, price=WAD, depositAssets=0, withdrawAssets=0),
    ]
    assert all_points(events) == {"0xaaa": {"trading": 5.0, "depositing": 70.0, "total": 75.0}}
