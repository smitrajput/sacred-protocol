import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

// The waitlist. POST stores one signup; GET with the admin key returns them all as CSV.
//
// Storage is Upstash Redis through Vercel's integration, which sets either the KV_* or the
// UPSTASH_* pair of variables. Without them (local development) signups go to a map in memory
// and are logged, so the form can be exercised without a store.
//
// Keys:  waitlist:entry:<email>   hash: email, wallet, handle, role, ref, code, at, ip
//        waitlist:joined          sorted set of emails by time, for export in order
//        waitlist:code:<code>     the email that owns a referral code
//        waitlist:referred:<code> how many signups came through that code
//        waitlist:ip:<ip>         a per-minute counter, for rate limiting

export const runtime = "nodejs";

const ROLES = ["trader", "depositor", "investor", "builder"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WALLET = /^0x[0-9a-fA-F]{40}$/;
const HANDLE = /^@?[A-Za-z0-9_]{1,15}$/;
const CODE = /^[a-z0-9]{8}$/;
const PER_MINUTE = 5;

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
const memory = globalThis.__waitlist ?? (globalThis.__waitlist = new Map());

// A referral code is the first 8 characters of a salted hash of the email: stable, short, and
// not reversible to the address.
const codeFor = (email) =>
  createHash("sha256")
    .update(`${process.env.WAITLIST_SALT || "sacred"}:${email}`)
    .digest("hex")
    .slice(0, 8);

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return bad("Send JSON.");
  }

  const email = String(body.email || "").trim().toLowerCase();
  const wallet = String(body.wallet || "").trim();
  const handle = String(body.handle || "").trim().replace(/^@/, "");
  const role = String(body.role || "").trim().toLowerCase();
  const ref = String(body.ref || "").trim().toLowerCase();

  if (!EMAIL.test(email) || email.length > 254) return bad("That email does not look right.");
  if (wallet && !WALLET.test(wallet)) return bad("A wallet is 0x followed by 40 hex characters.");
  if (handle && !HANDLE.test(handle)) return bad("An X handle is up to 15 letters, numbers or underscores.");
  if (role && !ROLES.includes(role)) return bad("Pick one of the roles offered.");
  if (ref && !CODE.test(ref)) return bad("That referral link is not valid.");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (redis) {
    const hits = await redis.incr(`waitlist:ip:${ip}`);
    if (hits === 1) await redis.expire(`waitlist:ip:${ip}`, 60);
    if (hits > PER_MINUTE) return new Response(JSON.stringify({ error: "Too many signups from here. Try again in a minute." }), { status: 429, headers: json });
  }

  const code = codeFor(email);
  const entry = { email, wallet, handle, role, ref: ref === code ? "" : ref, code, at: new Date().toISOString(), ip };

  if (redis) {
    const key = `waitlist:entry:${email}`;
    const existed = await redis.exists(key);
    if (existed) {
      // A repeat signup updates the optional fields and keeps the first referral and time.
      const { ref: _ref, at: _at, ...update } = entry;
      await redis.hset(key, update);
    } else {
      await redis.hset(key, entry);
      await redis.zadd("waitlist:joined", { score: Date.now(), member: email });
      await redis.set(`waitlist:code:${code}`, email);
      if (entry.ref && (await redis.exists(`waitlist:code:${entry.ref}`))) await redis.incr(`waitlist:referred:${entry.ref}`);
    }
  } else {
    memory.set(email, { ...memory.get(email), ...entry });
    console.log("[waitlist] no store configured; kept in memory:", entry);
  }

  return new Response(JSON.stringify({ ok: true, code }), { status: 200, headers: json });
}

// GET /api/waitlist?key=<WAITLIST_ADMIN_KEY> downloads the list as CSV, oldest first.
export async function GET(request) {
  const key = process.env.WAITLIST_ADMIN_KEY;
  const given = new URL(request.url).searchParams.get("key");
  if (!key || given !== key) return new Response("Not found", { status: 404 });

  let entries;
  if (redis) {
    const emails = await redis.zrange("waitlist:joined", 0, -1);
    entries = await Promise.all(emails.map((e) => redis.hgetall(`waitlist:entry:${e}`)));
    const referred = await Promise.all(entries.map((e) => redis.get(`waitlist:referred:${e.code}`)));
    entries.forEach((e, i) => (e.referred = Number(referred[i] || 0)));
  } else {
    entries = [...memory.values()].map((e) => ({ ...e, referred: 0 }));
  }

  const cols = ["at", "email", "role", "wallet", "handle", "code", "ref", "referred"];
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...entries.filter(Boolean).map((e) => cols.map((c) => cell(e[c])).join(","))].join("\n");
  return new Response(csv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="waitlist.csv"' } });
}

const json = { "content-type": "application/json" };
const bad = (error) => new Response(JSON.stringify({ error }), { status: 400, headers: json });
