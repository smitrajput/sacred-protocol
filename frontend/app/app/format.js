// Dates are rendered in UTC with a fixed locale so the server and the browser print the same
// string (the preview renders on the server too).

export const formatDay = (seconds) =>
  new Date(Number(seconds) * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export const formatMoment = (seconds) =>
  `${new Date(Number(seconds) * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
