import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://shipiq1.vercel.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://shipiq1.vercel.app/calculator', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://shipiq1.vercel.app/auth', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://shipiq1.vercel.app/privacy', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://shipiq1.vercel.app/terms', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]
}
