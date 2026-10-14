import { formatUnits } from "viem";
import deskAbi from "../../../abi/Desk.json";
import oracleAbi from "../../../abi/Oracle.json";
import vaultAbi from "../../../abi/Vault.json";
import { alchemyClient } from "../../../lib/alchemy";

// The deployed buckets as the chain has them now, read on the server through Alchemy when the
// page is built and again at most once a minute after. Without ALCHEMY_API_KEY (local
// development) the section is left out; a chain that does not answer shows a line saying so.

const CHAINS = [
  {
    id: 42161,
    name: "Arbitrum One",
    buckets: [
      { name: "BTC", decimals: 8, vault: "0xbbB8891463EB7ac9DF3d81947491A733a1C3a916", desk: "0x527ca589937A35504A5535fa1A89a0C8d42c667b", oracle: "0xd49Be92294e17db719625766142655346c60543D" },
      { name: "ETH", decimals: 18, vault: "0x87e1D4Bc94c932124E856963dE1a7Dc0E3E5Ed37", desk: "0x054738143B3126D943f97b4572bcDa155A9Af71d", oracle: "0xB3D58e5F9D1C862CE88641C52DC43c2693C5f61F" },
    ],
  },
  {
    id: 10143,
    name: "Monad testnet",
    buckets: [
      { name: "BTC", decimals: 8, vault: "0xf4623B09196469b02e287EA34B2e87DC6F948019", desk: "0x8A324a2925A50a0212532df28C972fD211068529", oracle: "0x4a23B639aaaD509FdB52533C054621C259a510d9" },
      { name: "ETH", decimals: 18, vault: "0x38a0772EE7f7EcA7cbc181814Abc0a187895722f", desk: "0x08c0F0699Ef17A44a6Ded158EdcA8F68338A312C", oracle: "0x1d8ebCf436EF2EB9286574CFEF559e86f1a36Db2" },
    ],
  },
];

const usd = (units) => Number(formatUnits(units, 6)).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const day = (seconds) => new Date(Number(seconds) * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";

async function readChain({ id, buckets }) {
  const client = alchemyClient(id);
  const [block, ...results] = await Promise.all([
    client.getBlockNumber(),
    ...buckets.map((b) =>
      client.multicall({
        allowFailure: false,
        contracts: [
          { address: b.oracle, abi: oracleAbi, functionName: "value", args: [10n ** BigInt(b.decimals)] },
          { address: b.vault, abi: vaultAbi, functionName: "navNow" },
          { address: b.vault, abi: vaultAbi, functionName: "lent" },
          { address: b.vault, abi: vaultAbi, functionName: "bucketCap" },
          { address: b.desk, abi: deskAbi, functionName: "liveCount" },
          { address: b.vault, abi: vaultAbi, functionName: "nextCutoff" },
        ],
      }),
    ),
  ]);
  return { block, rows: results };
}

export default async function LiveChain() {
  if (!process.env.ALCHEMY_API_KEY) return null;
  const chains = await Promise.all(
    CHAINS.map(async (c) => {
      try {
        return { ...c, ...(await readChain(c)) };
      } catch {
        return { ...c, failed: true };
      }
    }),
  );
  const readAt = new Date().toISOString().slice(0, 16).replace("T", " ");

  return (
    <>
      <p>
        Read from the chain through Alchemy at {readAt} UTC, and again at most once a minute. The coin price is what each
        desk&apos;s oracle reports: Chainlink on Arbitrum One, the set test feed on Monad testnet.
      </p>
      {chains.map((c) =>
        c.failed ? (
          <p key={c.id}>
            {c.name}: the chain did not answer just now.
          </p>
        ) : (
          <table key={c.id}>
            <thead>
              <tr>
                <th>
                  {c.name}, block {c.block.toLocaleString("en-US")}
                </th>
                <th>Coin price</th>
                <th>In the vault</th>
                <th>Lent out</th>
                <th>Cap</th>
                <th>Open positions</th>
                <th>Next cut-off</th>
              </tr>
            </thead>
            <tbody>
              {c.buckets.map((b, i) => {
                const [price, nav, lent, cap, live, cutoff] = c.rows[i];
                return (
                  <tr key={b.name}>
                    <td>{b.name} bucket</td>
                    <td>${usd(price)}</td>
                    <td>{usd(nav)} USDC</td>
                    <td>{usd(lent)} USDC</td>
                    <td>{usd(cap)} USDC</td>
                    <td>{String(live)}</td>
                    <td>
                      {day(cutoff)}
                      {Number(cutoff) * 1000 < Date.now() && ", due now"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ),
      )}
    </>
  );
}
