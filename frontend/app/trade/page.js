import ProductPage from "../landing/ProductPage";
import TradeQuote from "../landing/TradeQuote";
import { pages } from "../landing/productPages";

const page = pages.trade;

export const metadata = {
  title: page.meta.title,
  description: page.meta.description,
  alternates: { canonical: "/trade" },
  openGraph: { title: `${page.meta.title} | Sacred`, description: page.meta.description, url: "/trade", type: "website", siteName: "Sacred" },
  twitter: { card: "summary_large_image", title: `${page.meta.title} | Sacred`, description: page.meta.description },
};

export default function TradePage() {
  return <ProductPage page={page} panel={<TradeQuote />} />;
}
