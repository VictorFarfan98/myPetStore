/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    supabase_url: process.env.supabase_url,
    supabase_publishable_key: process.env.supabase_publishable_key
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      }
    ]
  },
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002"
  ]
};

export default nextConfig;
