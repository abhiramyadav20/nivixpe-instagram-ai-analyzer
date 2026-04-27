import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NIVIXPE — Instagram AI Analyzer',
  description: 'Instagram analytics, competitor research & AI-powered content strategy. Scrape reels, analyze performance, and generate content ideas with GPT-4o.',
  keywords: ['Instagram analytics', 'content strategy', 'AI content ideas', 'reel analytics', 'competitor analysis'],
  authors: [{ name: 'Nivixpe' }],
  openGraph: {
    title: 'NIVIXPE — AI Content Dashboard',
    description: 'Instagram analytics, competitor research & AI-powered content strategy',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#080b11',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen" style={{ backgroundColor: 'var(--color-surface-950)' }}>
        {children}
      </body>
    </html>
  )
}
