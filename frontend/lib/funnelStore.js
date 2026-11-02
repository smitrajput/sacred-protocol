import { Redis } from "@upstash/redis";

// Server-side funnel totals, in Upstash Redis through the same variables as the waitlist. Without
// them (local development) totals stay in memory. Keys: funnel:<yyyy-mm-dd>, a hash of
// "<page>|<product>|<campaign>|<stage>" to a count, kept for 400 days.

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const redis = url && token ? new Redis({ url, token }) : null;

const memory = globalThis.__funnel ?? (globalThis.__funnel = new Map());
const TTL = 400 * 24 * 60 * 60;

const clean = (value, fallback = "-") => String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 60) || fallback;

export async function record(stage, { page, product, campaign } = {}) {
  const day = new Date().toISOString().slice(0, 10);
  const field = [clean(page), clean(product), clean(campaign), stage].join("|");
  if (redis) {
    const key = `funnel:${day}`;
    await redis.hincrby(key, field, 1);
    await redis.expire(key, TTL);
  } else {
    const key = `${day}|${field}`;
    memory.set(key, (memory.get(key) || 0) + 1);
  }
}

// Every total from the last `days` days, as rows of day, page, product, campaign, stage, count.
export async function rows(days = 90) {
  const out = [];
  if (redis) {
    const dates = Array.from({ length: days }, (_, i) => new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
    const hashes = await Promise.all(dates.map((d) => redis.hgetall(`funnel:${d}`)));
    hashes.forEach((hash, i) => {
      Object.entries(hash || {}).forEach(([field, count]) => out.push([dates[i], ...field.split("|"), Number(count)]));
    });
  } else {
    memory.forEach((count, key) => out.push([...key.split("|"), count]));
  }
  return out;
}
