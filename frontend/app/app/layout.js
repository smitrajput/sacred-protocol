import Providers from "../providers";

export const metadata = { title: "App" };

// The wallet-connected app lives under /app. Wagmi and react-query load only here.
export default function AppLayout({ children }) {
  return <Providers>{children}</Providers>;
}
