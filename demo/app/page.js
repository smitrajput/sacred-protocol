"use client";

import dynamic from "next/dynamic";

// The simulated chain starts from the browser's clock, so the app renders in the browser only.
const App = dynamic(() => import("./app/App"), { ssr: false });

export default function Page() {
  return <App />;
}
