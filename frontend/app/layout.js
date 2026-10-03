import "./globals.css";
import Providers from "./providers";

export const metadata = { title: "Destiny", description: "Halal leverage and yield. No interest anywhere." };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
