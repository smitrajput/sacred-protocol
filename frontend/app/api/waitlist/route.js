import { createHash } from "node:crypto";
import { record, redis } from "../../../lib/funnelStore";

// The waitlist. POST stores one signup, PATCH adds the optional answers after it, and GET with the
// admin key returns them all as CSV.
//
// Storage is Upstash Redis through Vercel's integration, which sets either the KV_* or the
// UPSTASH_* pair of variables. Without them (local development) signups go to a map in memory
// and are logged, so the form can be exercised without a store.
//
// Keys:  waitlist:entry:<email>   hash: email, interests, source, campaign, ref, code, at, ip,
//                                 country, funding, device (older rows also have wallet, handle, role)
//        waitlist:joined          sorted set of emails by time, for export in order
//        waitlist:code:<code>     the email that owns a referral code
//        waitlist:referred:<code> how many signups came through that code
//        waitlist:ip:<ip>         a per-minute counter, for rate limiting

export const runtime = "nodejs";

const INTERESTS = ["earn", "trade", "borrow"];
const SOURCES = ["home", "earn", "trade", "borrow"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE = /^[a-z0-9]{8}$/;
const CAMPAIGN = /^[a-zA-Z0-9_.-]{1,60}$/;
const PER_MINUTE = 5;

const memory = globalThis.__waitlist ?? (globalThis.__waitlist = new Map());

// A referral code is the first 8 characters of a salted hash of the email: stable, short, and
// not reversible to the address.
const codeFor = (email) =>
  createHash("sha256")
    .update(`${process.env.WAITLIST_SALT || "sacred"}:${email}`)
    .digest("hex")
    .slice(0, 8);

async function limited(request) {
  if (!redis) return false;
  const ip = clientIp(request);
  const hits = await redis.incr(`waitlist:ip:${ip}`);
  if (hits === 1) await redis.expire(`waitlist:ip:${ip}`, 60);
  return hits > PER_MINUTE;
}

const clientIp = (request) => request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return bad("Send JSON.");
  }

  const email = String(body.email || "").trim().toLowerCase();
  const interests = [].concat(body.interests || []).map((v) => String(v).toLowerCase());
  const ref = String(body.ref || "").trim().toLowerCase();
  const source = SOURCES.includes(body.source) ? body.source : "home";
  const campaign = CAMPAIGN.test(body.campaign || "") ? body.campaign : "";

  if (!EMAIL.test(email) || email.length > 254) return bad("That email does not look right.");
  if (interests.some((v) => !INTERESTS.includes(v))) return bad("Pick from the options offered.");
  if (ref && !CODE.test(ref)) return bad("That referral link is not valid.");
  if (await limited(request)) return tooMany();

  const code = codeFor(email);
  const entry = { email, interests: interests.join(","), source, campaign, ref: ref === code ? "" : ref, code, at: new Date().toISOString(), ip: clientIp(request) };

  let isNew = true;
  if (redis) {
    const key = `waitlist:entry:${email}`;
    isNew = !(await redis.exists(key));
    if (isNew) {
      await redis.hset(key, entry);
      await redis.zadd("waitlist:joined", { score: Date.now(), member: email });
      await redis.set(`waitlist:code:${code}`, email);
      if (entry.ref && (await redis.exists(`waitlist:code:${entry.ref}`))) await redis.incr(`waitlist:referred:${entry.ref}`);
    } else if (entry.interests) {
      // A repeat signup updates what they want to do and keeps the first source, referral and time.
      await redis.hset(key, { interests: entry.interests });
    }
  } else {
    isNew = !memory.has(email);
    memory.set(email, { ...memory.get(email), ...entry });
    console.log("[waitlist] no store configured; kept in memory:", entry);
  }

  if (isNew) await record("signup", { page: source, product: interests.join("+"), campaign });
  return new Response(JSON.stringify({ ok: true, code }), { status: 200, headers: json });
}

// The optional answers after signup. The code proves the same browser that signed up is asking,
// so nobody can overwrite an entry knowing only the email.
export async function PATCH(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return bad("Send JSON.");
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL.test(email) || body.code !== codeFor(email)) return bad("That signup was not found.");
  if (await limited(request)) return tooMany();

  const text = (v, max) => String(v || "").replace(/[\r\n]/g, " ").trim().slice(0, max);
  const answers = Object.fromEntries(
    Object.entries({ country: text(body.country, 60), funding: text(body.funding, 40), device: text(body.device, 40) }).filter(([, v]) => v),
  );
  if (!Object.keys(answers).length) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: json });

  if (redis) {
    const key = `waitlist:entry:${email}`;
    if (!(await redis.exists(key))) return bad("That signup was not found.");
    await redis.hset(key, answers);
    const entry = await redis.hgetall(key);
    await record("profile", { page: entry?.source, campaign: entry?.campaign });
  } else {
    if (!memory.has(email)) return bad("That signup was not found.");
    memory.set(email, { ...memory.get(email), ...answers });
    await record("profile", { page: memory.get(email).source, campaign: memory.get(email).campaign });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: json });
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

  const cols = ["at", "email", "interests", "source", "campaign", "country", "funding", "device", "code", "ref", "referred", "role", "wallet", "handle"];
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...entries.filter(Boolean).map((e) => cols.map((c) => cell(e[c])).join(","))].join("\n");
  return new Response(csv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="waitlist.csv"' } });
}

const json = { "content-type": "application/json" };
const bad = (error) => new Response(JSON.stringify({ error }), { status: 400, headers: json });
const tooMany = () => new Response(JSON.stringify({ error: "Too many signups from here. Try again in a minute." }), { status: 429, headers: json });
