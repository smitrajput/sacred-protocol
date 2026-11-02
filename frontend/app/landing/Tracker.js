"use client";

import { useEffect } from "react";
import { track } from "../../lib/funnel";

// Counts a page view, and clicks on anything marked data-track, for the funnel. No cookies and no
// identifiers: only totals per day, page and campaign.
export default function Tracker({ page }) {
  useEffect(() => {
    track("view", { page });
    function onClick(event) {
      const target = event.target.closest?.("[data-track]");
      if (target) track(target.dataset.track, { page, product: target.dataset.product });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [page]);
  return null;
}
