import ProductPage from "../landing/ProductPage";
import { EarnPanel } from "../landing/Panels";
import { pages } from "../landing/productPages";

const page = pages.earn;

export const metadata = {
  title: page.meta.title,
  description: page.meta.description,
  alternates: { canonical: "/earn" },
  openGraph: { title: `${page.meta.title} | Sacred`, description: page.meta.description, url: "/earn", type: "website", siteName: "Sacred" },
  twitter: { card: "summary_large_image", title: `${page.meta.title} | Sacred`, description: page.meta.description },
};

export default function EarnPage() {
  return <ProductPage page={page} panel={<EarnPanel />} />;
}
