// The demo's stand-in for the app's lib/contracts.js. The components import the same names; each
// contract is only a label here, which the simulated chain (lib/sim.js) dispatches on.

export const preview = false;
export const assetSymbol = "MON";
export const assetDecimals = 18;

export const vault = { address: "vault" };
export const desk = { address: "desk" };
export const usdc = { address: "usdc" };
export const oracle = { address: "oracle" };

export const STATUS = ["None", "Live", "Closed", "Paid off", "Settled", "Settled short"];
