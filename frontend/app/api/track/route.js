import { BROWSER_STAGES } from "../../../lib/funnel";
import { record, redis, rows } from "../../../lib/funnelStore";

// POST counts one anonymous funnel step from a page. GET with the admin key returns the totals as
// CSV, the same way the waitlist export works.

export const runtime = "nodejs";

const PER_MINUTE = 60;
const ok = () => new Response(null, { status: 204 });

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return ok();
  }
  if (!BROWSER_STAGES.includes(body.stage)) return ok();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (redis) {
    const hits = await redis.incr(`track:ip:${ip}`);
    if (hits === 1) await redis.expire(`track:ip:${ip}`, 60);
    if (hits > PER_MINUTE) return ok();
  }

  await record(body.stage, body);
  return ok();
}

export async function GET(request) {
  const key = process.env.WAITLIST_ADMIN_KEY;
  const given = new URL(request.url).searchParams.get("key");
  if (!key || given !== key) return new Response("Not found", { status: 404 });

  const lines = ["day,page,product,campaign,stage,count", ...(await rows()).map((row) => row.join(","))];
  return new Response(lines.join("\n"), {
    status: 200,
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="funnel.csv"' },
  });
}
