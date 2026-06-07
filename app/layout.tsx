import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Runway — Music Discovery Dashboard',
  description: 'KIMI & CLAUDE music discovery for Dekan and Jim',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}
