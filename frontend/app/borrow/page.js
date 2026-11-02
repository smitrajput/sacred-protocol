import ProductPage from "../landing/ProductPage";
import { BorrowPanel } from "../landing/Panels";
import { pages } from "../landing/productPages";

const page = pages.borrow;

export const metadata = {
  title: page.meta.title,
  description: page.meta.description,
  alternates: { canonical: "/borrow" },
  openGraph: { title: `${page.meta.title} | Sacred`, description: page.meta.description, url: "/borrow", type: "website", siteName: "Sacred" },
  twitter: { card: "summary_large_image", title: `${page.meta.title} | Sacred`, description: page.meta.description },
};

export default function BorrowPage() {
  return <ProductPage page={page} panel={<BorrowPanel />} />;
}
