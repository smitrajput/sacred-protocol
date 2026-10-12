import { assetSymbol } from "../../lib/contracts";
import { getSpotPrice } from "../../lib/price";
import App from "./App";

// The app page fetches the asset's spot price on the server (refreshed every minute) and hands
// it, with the render time, to the client-side App. Both only feed display figures.
export default async function AppPage() {
  const spotPrice = await getSpotPrice(assetSymbol);
  return <App spotPrice={spotPrice} renderedAt={Math.floor(Date.now() / 1000)} />;
}
