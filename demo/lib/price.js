import { parseUsdc } from "./math";

// MON trades at a few cents, so prices keep six decimals in USDC units and show four.
export const priceToUnits = (price) => parseUsdc(price.toFixed(6));

export const formatPrice = (price) =>
  price.toLocaleString("en-US", { minimumFractionDigits: price < 1 ? 4 : 2, maximumFractionDigits: price < 1 ? 4 : 2 });
