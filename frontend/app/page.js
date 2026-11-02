import { borrow, earn, trade } from "./landing/content";
import Faq from "./landing/Faq";
import Footer from "./landing/Footer";
import Funding from "./landing/Funding";
import Hero from "./landing/Hero";
import Nav from "./landing/Nav";
import { BorrowPanel, EarnPanel } from "./landing/Panels";
import ProductSection from "./landing/ProductSection";
import Sift from "./landing/Sift";
import Tracker from "./landing/Tracker";
import TradeQuote from "./landing/TradeQuote";
import Waitlist from "./landing/Waitlist";

// The landing page: the promise, one equal section per product, how money gets in, short answers
// and signup. SIFT sits inside Trade, which it powers; Shariah and security live in the docs.
// Copy lives in landing/content.js; styles in landing.module.css.
export default function LandingPage() {
  return (
    <>
      <Tracker page="home" />
      <Nav />
      <main>
        <Hero />
        <ProductSection product={earn}>
          <EarnPanel />
        </ProductSection>
        <ProductSection product={trade} reverse after={<Sift />}>
          <TradeQuote />
        </ProductSection>
        <ProductSection product={borrow}>
          <BorrowPanel />
        </ProductSection>
        <Funding />
        <Faq />
        <Waitlist />
      </main>
      <Footer />
    </>
  );
}
