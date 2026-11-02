// The proposed launch parameters for Earn, Trade (with SIFT) and Borrow, in one place. The landing
// page and its calculators read from here; the docs quote the same figures. They are copied from
// the research parameter files as of 2 November 2026 (Sacred self funded margin launch, Sacred
// SIFT trader curation, Sacred Arc collateral financing). None is deployed, audited or
// Shariah-approved. The contracts on Arbitrum One still run the first design: lib/defaults.js.

import siftSchedule from "./siftSchedule.json";

// ---- Trade: one fixed sale per position ----

export const TERM_DAYS = 14;
export const YEAR_DAYS = 365; // ACT/365

// Assumed route costs for quotes, not measured Arc fills: entry and exit on the whole position,
// plus a fixed round-trip charge.
export const EXECUTION = { entryBps: 5, exitBps: 5, fixedRoundTrip: 1 };

// 2× opens first. Higher rungs open gradually, as their protection is earned, execution is validated
// and Shariah rulings are approved.
export const LADDER = [
  { leverage: 2, apr: 0.1, trigger: 1.6, restore: 1.9, lpShare: 0.77, primary: 0.004, tail: 0.006, cap: null },
  { leverage: 2.5, apr: 0.11, trigger: 1.45, restore: 1.6, lpShare: 0.7454545454545456, primary: 0.005, tail: 0.01, cap: 0.25 },
  { leverage: 3, apr: 0.125, trigger: 1.3, restore: 1.45, lpShare: 0.716, primary: 0.015, tail: 0.075, cap: 0.15 },
  { leverage: 3.5, apr: 0.14, trigger: 1.25, restore: 1.35, lpShare: 0.692857142857143, primary: 0.025, tail: 0.075, cap: 0.075 },
  { leverage: 4, apr: 0.16, trigger: 1.2, restore: 1.3, lpShare: 0.66875, primary: 0.045, tail: 0.095, cap: 0.05 },
  { leverage: 4.5, apr: 0.18, trigger: 1.16, restore: 1.25, lpShare: 0.65, primary: 0.065, tail: 0.105, cap: 0.025 },
  { leverage: 5, apr: 0.2, trigger: 1.15, restore: 1.23, lpShare: 0.635, primary: 0.065, tail: 0.105, cap: 0.01 },
];

export const LAUNCH_TIER = LADDER[0];

// ---- SIFT: financing capacity per account ----
// `schedule` is the published ceiling for each qualifying funded day, copied unchanged from the
// research growth_schedule.json. The tests check its hash.

export const SIFT = {
  schedule: siftSchedule.daily_cap_usdc,
  starterCeiling: 500,
  accountCap: 100_000,
  navCap: 0.01,
  milestones: [
    { weeks: 2, day: 14 },
    { weeks: 6, day: 42 },
    { weeks: 12, day: 84 },
  ],
  checkpointDays: 14,
  minUse: 0.5,
  drawdownPause: 0.1,
  drawdownHalve: 0.2,
  drawdownFreeze: 0.3,
  newcomerSleeve: 0.05,
};

// ---- Earn: the MarginVault's modeled returns at $10m active NAV ----
// Demand is a chosen sensitivity, not a forecast. APY compounds 14-day reinvestment.

export const EARN = {
  normalShare: 0.77,
  conservationShare: 0.7,
  financingCap: 0.95,
  idleTarget: 0.1,
  idleFloor: 0.05,
  // Markup actually collected per financed dollar-year, from the replay. Just under the 10% quote.
  collectedRate: 0.0997,
  cases: [
    { name: "Strong demand", use: 0.9, apr: 0.0691, apy: 0.0714, share: 0.77 },
    { name: "Moderate demand", use: 0.75, apr: 0.0576, apy: 0.0592, share: 0.77 },
    { name: "Weak demand", use: 0.5, apr: 0.0349, apy: 0.0355, share: 0.7 },
  ],
};

// ---- Borrow: a fixed sale of USDC against pledged collateral ----

export const BORROW = {
  termDays: 30,
  referenceApr: 0.08, // audited reference only; the launch quote is unset until approved
  entryLtv: 0.45,
  liquidationLtv: 0.625,
  restoreLtv: 0.5,
  minFinancing: 1_000,
  maxPerBorrower: 5_000,
  pilotCeiling: 250_000,
  routeCeiling: 125_000,
  dust: 250,
  cureHours: 24,
};
