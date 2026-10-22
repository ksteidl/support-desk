import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // IMAP/SMTP libraries rely on Node built-ins and must not be bundled.
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
