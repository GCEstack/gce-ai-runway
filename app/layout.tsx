import type { Metadata } from 'next'
import './globals.css'
import { CsrfProvider } from '@/components/CsrfProvider'

export const metadata: Metadata = {
  title: 'Runway — Music Discovery Dashboard',
  description: 'KIMI & CLAUDE music discovery for Dekan and Jim',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <CsrfProvider>{children}</CsrfProvider>
      </body>
    </html>
  )
}
