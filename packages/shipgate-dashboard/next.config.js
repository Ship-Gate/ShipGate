/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do not use output: 'standalone' on Netlify — it breaks @netlify/plugin-nextjs
  // (Cannot find module 'next/dist/server/lib/start-server.js')
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  experimental: {
    serverComponentsExternalPackages: ['@boxyhq/saml-jackson'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
};
module.exports = nextConfig;
