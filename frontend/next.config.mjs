import createMDX from "@next/mdx";

// Old hosts forward to the one canonical domain. destiny-term-mode.vercel.app is left alone:
// it was submitted on a hackathon form and should keep serving the site as it is.
const OLD_HOSTS = ["www.sacred.markets", "sacred-protocol.vercel.app"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The docs under app/docs are written in MDX; mdx-components.js maps their elements.
  pageExtensions: ["js", "jsx", "mdx"],
  async redirects() {
    return OLD_HOSTS.map((host) => ({
      source: "/:path*",
      has: [{ type: "host", value: host }],
      destination: "https://sacred.markets/:path*",
      permanent: true,
    }));
  },
};

// Plugins are named as strings so the config stays serialisable for Turbopack.
export default createMDX({ options: { remarkPlugins: ["remark-gfm"] } })(nextConfig);
