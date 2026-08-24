// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import Nav from '@/components/layout/Nav'
import './globals.css'

export const metadata: Metadata = {
  title: 'Boarding Life',
  description: 'Calendar, wellness journal, finance, and dorm directory for boarding students.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Boarding Life',
  },
}

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 pb-16 sm:pb-0">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  )
}
