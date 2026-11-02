// The funnel each acquisition page is measured on: product interest → signup → funding → first
// action → retained use. The browser reports the first steps; the server records signups and the
// app will report the rest once accounts exist. Only totals are kept: no cookies and no identifiers.

export const STAGES = ["view", "interest", "signup", "profile", "funded", "first_action", "retained"];

// The only stages a browser may report. The rest are recorded on the server.
export const BROWSER_STAGES = ["view", "interest"];

// A campaign name from the URL, remembered for the visit so a later page keeps it.
export function campaignFromUrl() {
  if (typeof window === "undefined") return "";
  const fromUrl = new URLSearchParams(window.location.search).get("utm_campaign");
  try {
    if (fromUrl) sessionStorage.setItem("sacred-campaign", fromUrl);
    return fromUrl || sessionStorage.getItem("sacred-campaign") || "";
  } catch {
    return fromUrl || "";
  }
}

export function track(stage, { page, product }) {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ stage, page, product, campaign: campaignFromUrl() });
  if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
    fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
}
