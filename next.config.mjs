/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",      // static export for IPFS / ENS contenthash
  trailingSlash: true,   // ensures clean paths when served from IPFS gateways
  images: {
    unoptimized: true,   // next/image needs this for static export
  },
  webpack: (config) => {
    const originalExternals = Array.isArray(config.externals) ? config.externals : [];
    config.externals = [
      ...originalExternals,
      "pino-pretty",
      "lokijs",
      "encoding",
      ({ request }, callback) => {
        // Externalize optional connectors with broken ESM deps
        const broken = ["porto", "@coinbase/cdp-sdk", "@base-org/account", "@metamask/sdk"];
        if (broken.some((pkg) => request?.startsWith(pkg))) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      },
    ];
    return config;
  },
};

export default nextConfig;
