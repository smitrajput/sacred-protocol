import { parseUsdc } from "./math";

// Spot price in USD from Coinbase's public endpoint, cached for a minute by Next. It is only
// used for display (quantities, the price slider, sample tickets); the contracts use Chainlink.
// Returns null when the price cannot be fetched, and callers must cope with that.
export async function getSpotPrice(symbol) {
  try {
    const res = await fetch(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const { data } = await res.json();
    const price = Number(data?.amount);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

// A price in USD as USDC units (6 decimals), for the BigInt arithmetic in lib/math.js.
export const priceToUnits = (price) => parseUsdc(price.toFixed(2));

export const formatPrice = (price) =>
  price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
