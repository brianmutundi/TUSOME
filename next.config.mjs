/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Linting runs as its own CI step (`npm run lint`); keep builds fast and
    // deterministic so a lint warning cannot block a production build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
