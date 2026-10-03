"""Points, computed from events alone.

Traders earn one point per USDC of markup they have paid.
Depositors earn one point per USDC per day deposited, counted at each weekly cut-off:
shares held at the cut-off, at that cut-off's price, times seven days.
Volume earns nothing, so farming points means paying depositors.
Points are a discretionary gift and promise nothing."""
from collections import defaultdict

USDC = 10**6
WAD = 10**18
DAYS_PER_EPOCH = 7


def trader_points(events: list[dict]) -> dict[str, float]:
    points = defaultdict(float)
    for e in events:
        if e["name"] == "Paid":
            points[e["args"]["owner"].lower()] += e["args"]["markup"] / USDC
    return dict(points)


def depositor_points(events: list[dict]) -> dict[str, float]:
    shares = defaultdict(int)
    points = defaultdict(float)
    for e in events:
        a = e["args"]
        if e["name"] == "DepositClaimed":
            shares[a["user"].lower()] += a["shares"]
        elif e["name"] == "WithdrawRequested":
            shares[a["user"].lower()] -= a["shares"]
        elif e["name"] == "WithdrawClaimed":
            shares[a["user"].lower()] += a["sharesReturned"]
        elif e["name"] == "Cutoff":
            for user, held in shares.items():
                if held > 0:
                    points[user] += held * a["price"] / WAD / USDC * DAYS_PER_EPOCH
    return dict(points)


def all_points(events: list[dict]) -> dict[str, dict[str, float]]:
    traders, depositors = trader_points(events), depositor_points(events)
    return {
        user: {"trading": traders.get(user, 0.0), "depositing": depositors.get(user, 0.0),
               "total": traders.get(user, 0.0) + depositors.get(user, 0.0)}
        for user in sorted(set(traders) | set(depositors))
    }
