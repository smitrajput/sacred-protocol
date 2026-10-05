// The test's own view of the chain: anvil's unlocked accounts for the actors, mock controls
// for the price, and reads to check what the app did.
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { foundry } from "viem/chains";

// anvil's default accounts. The deployer is also manager, treasury and distributor.
export const ACCOUNTS = {
  deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  depositor: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  trader: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  staker: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  buyer: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
};
export const KEEPER_KEY = "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6"; // account 9

export const USDC = 10n ** 6n;
export const SCR = 10n ** 18n;
export const DAY = 86_400;

const abi = {
  erc20: parseAbi([
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address, uint256) returns (bool)",
    "function mint(address, uint256)",
  ]),
  feed: parseAbi(["function set(int256)"]),
  router: parseAbi(["function setPrice(uint256)"]),
  vault: parseAbi([
    "function epoch() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function requestDeposit(uint256)",
  ]),
  approve: parseAbi(["function approve(address, uint256) returns (bool)"]),
  desk: parseAbi([
    "function getTicket(uint256) view returns ((address owner, uint8 status, uint40 opened, uint40 due, uint256 qty, uint256 cost, uint256 downPayment, uint256 financed, uint256 markup, uint256 repaid, uint256 principalRepaid))",
  ]),
  fund: parseAbi(["function stakeOf(address) view returns (uint256)"]),
  sale: parseAbi(["function price() view returns (uint256)"]),
  reserve: parseAbi(["function totalAssets() view returns (uint256)"]),
};

export function makeChain({ rpcUrl, addresses }) {
  const pub = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  const read = (key, name, functionName, args = []) =>
    pub.readContract({ address: addresses[key], abi: abi[name], functionName, args });
  const write = async (account, key, name, functionName, args) => {
    const wallet = createWalletClient({ account, chain: foundry, transport: http(rpcUrl) });
    const hash = await wallet.writeContract({ address: addresses[key], abi: abi[name], functionName, args });
    return pub.waitForTransactionReceipt({ hash });
  };

  return {
    addresses,
    pub,
    // Move the chain's clock. The keeper and the app both read block time.
    async travel(seconds) {
      await pub.request({ method: "evm_increaseTime", params: [seconds] });
      await pub.request({ method: "evm_mine", params: [] });
    },
    mintUsdc: (to, amount) => write(ACCOUNTS.deployer, "usdc", "erc20", "mint", [to, amount]),
    // The manager must hold at least 5% of a bucket before anyone else may deposit.
    async seedManager(amount) {
      await write(ACCOUNTS.deployer, "usdc", "approve", "approve", [addresses.vault, amount]);
      await write(ACCOUNTS.deployer, "vault", "vault", "requestDeposit", [amount]);
    },
    giveScr: (to, amount) => write(ACCOUNTS.deployer, "token", "erc20", "transfer", [to, amount]),
    // The feed and the spot market move together, as a real market would.
    async setPrice(usdPerBtc) {
      await write(ACCOUNTS.deployer, "feed", "feed", "set", [BigInt(usdPerBtc) * 10n ** 8n]);
      await write(ACCOUNTS.deployer, "router", "router", "setPrice", [BigInt(usdPerBtc) * USDC]);
    },
    usdcOf: (who) => read("usdc", "erc20", "balanceOf", [who]),
    scrOf: (who) => read("token", "erc20", "balanceOf", [who]),
    coinOf: (who) => read("coin", "erc20", "balanceOf", [who]),
    sharesOf: (who) => read("vault", "vault", "balanceOf", [who]),
    stakeOf: (who) => read("fund", "fund", "stakeOf", [who]),
    epoch: () => read("vault", "vault", "epoch"),
    ticket: (id) => read("desk", "desk", "getTicket", [id]),
    salePrice: () => read("sale", "sale", "price"),
    reserveAssets: () => read("reserve", "reserve", "totalAssets"),
  };
}

// Token units as the app prints them: grouped, with `digits` decimals, rounded half up.
export function format(units, decimals, digits = 2) {
  const scale = 10n ** BigInt(decimals - digits);
  const rounded = (units + scale / 2n) / scale;
  const whole = rounded / 10n ** BigInt(digits);
  const frac = (rounded % 10n ** BigInt(digits)).toString().padStart(digits, "0");
  return `${whole.toLocaleString("en-US")}${digits > 0 ? `.${frac}` : ""}`;
}
