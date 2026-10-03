import vaultAbi from "../abi/Vault.json";
import deskAbi from "../abi/Desk.json";
import erc20Abi from "../abi/MockERC20.json";
import oracleAbi from "../abi/Oracle.json";
import local from "./local.json";

// Addresses come from the environment in production and from the local deployment otherwise.
const env = (key, fallback) => process.env[`NEXT_PUBLIC_${key}`] || fallback;

export const addresses = {
  vault: env("VAULT", local.vault),
  desk: env("DESK", local.desk),
  usdc: env("USDC", local.usdc),
  oracle: env("ORACLE", local.oracle),
};
export const apiUrl = env("API_URL", "http://127.0.0.1:8000");
export const coinSymbol = env("COIN_SYMBOL", "BTC");
export const coinDecimals = Number(env("COIN_DECIMALS", "8"));

export const vault = { address: addresses.vault, abi: vaultAbi };
export const desk = { address: addresses.desk, abi: deskAbi };
export const usdc = { address: addresses.usdc, abi: erc20Abi };
export const oracle = { address: addresses.oracle, abi: oracleAbi };

export const STATUS = ["None", "Live", "Closed", "Paid off", "Settled", "Settled short"];
