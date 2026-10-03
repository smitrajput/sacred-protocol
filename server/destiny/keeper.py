"""The keeper does two jobs anyone could do: run the weekly cut-off once it is due and
settle tickets once their due date has passed. It holds no special rights. If it
stops, anyone can call the same two functions; nothing in the protocol waits on it
for an exit."""
import logging
import time

log = logging.getLogger("keeper")


def tick(chain) -> list[dict]:
    """One pass. Returns what was done. One failure never stops the rest."""
    actions = []
    now = chain.now()

    for ticket_id in chain.live_ids():
        try:
            if chain.ticket(ticket_id).due < now:
                actions.append({"action": "settle", "ticket": ticket_id, "tx": chain.settle(ticket_id)})
        except Exception as error:  # e.g. the sale is below the price floor; try again next pass
            log.warning("settle %s failed: %s", ticket_id, error)
            actions.append({"action": "settle", "ticket": ticket_id, "error": str(error)})

    # Settle first, so the cut-off prices as few live tickets as possible.
    if chain.next_cutoff() <= now:
        try:
            actions.append({"action": "cutoff", "tx": chain.cutoff()})
        except Exception as error:  # e.g. the price feed is stale
            log.warning("cutoff failed: %s", error)
            actions.append({"action": "cutoff", "error": str(error)})
    return actions


def run_forever(chain, poll_seconds: int) -> None:
    while True:
        for action in tick(chain):
            log.info("%s", action)
        time.sleep(poll_seconds)


if __name__ == "__main__":
    from .chain import Chain
    from .config import Config

    logging.basicConfig(level=logging.INFO)
    config = Config.from_env()
    run_forever(Chain(config), config.poll_seconds)
