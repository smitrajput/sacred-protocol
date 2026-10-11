import { getSpotPrice } from "../lib/price";
import { exampleCoin } from "./landing/content";
import Footer from "./landing/Footer";
import Hero from "./landing/Hero";
import Leverage from "./landing/Leverage";
import Nav from "./landing/Nav";
import Safety from "./landing/Safety";
import Shariah from "./landing/Shariah";
import Waitlist from "./landing/Waitlist";
import Why from "./landing/Why";
import Yield from "./landing/Yield";

// The landing page: the promise, the problem it answers, how the yield and the leverage work,
// why it is halal, what protects a deposit, and the waitlist. Every section is a server
// component except the live ticket in Leverage, which gets the coin's spot price (refreshed
// every minute) so its figures are concrete, and the waitlist form. Copy lives in
// landing/content.js; styles in landing.module.css.
export default async function LandingPage() {
  const price = await getSpotPrice(exampleCoin);
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Why />
        <Yield />
        <Leverage price={price} />
        <Shariah />
        <Safety />
        <Waitlist />
      </main>
      <Footer />
    </>
  );
}
