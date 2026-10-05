import { erc20Abi } from "viem";
import deskAbi from "../abi/Desk.json";
import fundAbi from "../abi/StakedBackstopFund.json";
import oracleAbi from "../abi/Oracle.json";
import reserveAbi from "../abi/Reserve.json";
import saleAbi from "../abi/ReserveSale.json";
import vaultAbi from "../abi/Vault.json";
import local from "./local.json";

// Addresses come from the environment in production and from the local deployment otherwise.
// Each variable is named in full because Next inlines only literal NEXT_PUBLIC_ references.
export const addresses = {
  vault: process.env.NEXT_PUBLIC_VAULT || local.vault,
  desk: process.env.NEXT_PUBLIC_DESK || local.desk,
  usdc: process.env.NEXT_PUBLIC_USDC || local.usdc,
  oracle: process.env.NEXT_PUBLIC_ORACLE || local.oracle,
  scr: process.env.NEXT_PUBLIC_SCR || local.token,
  fund: process.env.NEXT_PUBLIC_FUND || local.fund,
  sale: process.env.NEXT_PUBLIC_SALE || local.sale,
  reserve: process.env.NEXT_PUBLIC_RESERVE || local.reserve,
};
export const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

// A production build with no contract addresses runs the app in preview: sample figures and no
// transactions. Local development keeps reading the anvil deployment from local.json.
export const preview = !process.env.NEXT_PUBLIC_VAULT && process.env.NODE_ENV === "production";

// The local deployment's mock coin is WBTC with 8 decimals; the preview shows the ETH bucket.
export const coinSymbol = process.env.NEXT_PUBLIC_COIN_SYMBOL || (preview ? "ETH" : "BTC");
export const coinDecimals = Number(process.env.NEXT_PUBLIC_COIN_DECIMALS || (preview ? "18" : "8"));

export const vault = { address: addresses.vault, abi: vaultAbi };
export const desk = { address: addresses.desk, abi: deskAbi };
export const usdc = { address: addresses.usdc, abi: erc20Abi };
export const oracle = { address: addresses.oracle, abi: oracleAbi };
export const scr = { address: addresses.scr, abi: erc20Abi };
export const fund = { address: addresses.fund, abi: fundAbi };
export const sale = { address: addresses.sale, abi: saleAbi };
export const reserve = { address: addresses.reserve, abi: reserveAbi };

export const STATUS = ["None", "Live", "Closed", "Paid off", "Settled", "Settled short"];
