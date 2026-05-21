/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizeCss: true,
  },
  images: {
    domains: ['pzlckjasayitxcblvkjg.supabase.co', 'logo.clearbit.com', 't2.gstatic.com', 'icon.horse'],
    formats: ['image/webp', 'image/avif'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
  poweredByHeader: false,
  compress: true,
}

module.exports = nextConfig
