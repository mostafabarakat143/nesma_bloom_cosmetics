import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const noStore = [{ key: "Cache-Control", value: "private, no-store" }];
const resetHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cache-Control", value: "private, no-store" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/reset-password", headers: resetHeaders },
      { source: "/ar/reset-password", headers: resetHeaders },
      { source: "/en/reset-password", headers: resetHeaders },
      { source: "/account", headers: noStore },
      { source: "/ar/account", headers: noStore },
      { source: "/en/account", headers: noStore },
      { source: "/account/:path*", headers: noStore },
      { source: "/ar/account/:path*", headers: noStore },
      { source: "/en/account/:path*", headers: noStore },
      { source: "/checkout", headers: noStore },
      { source: "/ar/checkout", headers: noStore },
      { source: "/en/checkout", headers: noStore },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
