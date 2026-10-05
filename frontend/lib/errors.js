// The contracts' custom errors in plain words. Anything not listed is shown by its name.

const REASONS = {
  // Vault
  NotAllowed: "This wallet is not on the allow-list.",
  Paused: "New business is paused. Every exit still works.",
  ZeroAmount: "The amount is zero.",
  TooEarly: "The cut-off is not due yet.",
  CapExceeded: "The bucket is at its cap.",
  ManagerShareTooLow: "The manager must hold at least 5% of the bucket; this would push it below.",
  InsufficientIdle: "The bucket does not have enough idle cash.",
  Unhealthy: "The bucket cannot finance this: it would pass the utilisation cap or use cash that queued withdrawals need.",
  // Desk
  BadLeverage: "That leverage is not offered.",
  BadTerm: "That term is not offered.",
  TooLarge: "The ticket is above the size limit.",
  TooManyTickets: "The desk has no room for another live ticket right now.",
  TooSmall: "The down payment is below the minimum.",
  NotLive: "The ticket is no longer live.",
  NotDue: "The ticket is not past its due date.",
  SaleBelowSettlement: "The coin would sell for less than the settlement amount. Pay off instead, or wait.",
  Slippage: "The market moved past your price limit. Try again.",
  BadAmount: "A part payment must be below the settlement amount. Use pay off for the whole balance.",
  // Backstop fund
  NothingStaked: "Nothing is staked.",
  NoRequest: "Request to unstake first, then wait out the cooldown.",
  CoolingDown: "Still cooling down.",
  WindowClosed: "The window to take the SCR out has closed. Request again.",
  // Reserve sale
  Closed: "The sale is closed: the reserve is at its target.",
  TwapNotReady: "The pool's average price needs 30 minutes of history first.",
  PeriodCapExceeded: "More than is left for sale this week.",
  CostAboveMax: "The price moved above your limit. Try again.",
  // Price feed
  StalePrice: "The price feed is stale. Try again once it updates.",
  SequencerDown: "The network's sequencer is down or has only just restarted.",
};

// A readable reason for a failed transaction. viem decodes a custom error against the ABI and
// leaves it in the cause chain; anything else falls back to its own short message.
export function explain(error) {
  for (let cause = error; cause; cause = cause.cause) {
    const name = cause.data?.errorName;
    if (name) return REASONS[name] || `The contract refused: ${name}.`;
    if (cause.name === "UserRejectedRequestError") return "You rejected the request in your wallet.";
  }
  return error.shortMessage || error.message;
}
