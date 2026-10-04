import { getSpotPrice } from "../lib/price";
import { exampleCoin } from "./landing/content";
import Footer from "./landing/Footer";
import Hero from "./landing/Hero";
import HowItWorks from "./landing/HowItWorks";
import Nav from "./landing/Nav";
import Rules from "./landing/Rules";
import Safety from "./landing/Safety";
import Shariah from "./landing/Shariah";
import Status from "./landing/Status";

// The landing page. Every section is a server component except the live ticket inside Hero,
// which gets the coin's spot price (refreshed every minute) so its figures are concrete.
// Copy lives in landing/content.js; shared styles in landing/landing.module.css.
export default async function LandingPage() {
  const price = await getSpotPrice(exampleCoin);
  return (
    <>
      <Nav />
      <main>
        <Hero price={price} />
        <HowItWorks />
        <Rules />
        <Safety />
        <Shariah />
        <Status />
      </main>
      <Footer />
    </>
  );
}
