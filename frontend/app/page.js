import { getSpotPrice } from "../lib/price";
import { exampleCoin } from "./landing/content";
import Footer from "./landing/Footer";
import Hero from "./landing/Hero";
import HowItWorks from "./landing/HowItWorks";
import Ledger from "./landing/Ledger";
import Nav from "./landing/Nav";
import Rules from "./landing/Rules";
import Safety from "./landing/Safety";
import Shariah from "./landing/Shariah";
import Status from "./landing/Status";
import Waitlist from "./landing/Waitlist";

// The landing page. Every section is a server component except the live ticket in HowItWorks,
// which gets the coin's spot price (refreshed every minute) so its figures are concrete, and
// the waitlist form at the end. Copy lives in landing/content.js; styles in landing.module.css.
export default async function LandingPage() {
  const price = await getSpotPrice(exampleCoin);
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Ledger />
        <HowItWorks price={price} />
        <Rules />
        <Safety />
        <Shariah />
        <Status />
        <Waitlist />
      </main>
      <Footer />
    </>
  );
}
