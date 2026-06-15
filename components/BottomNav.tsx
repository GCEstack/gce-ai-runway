'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ListMusic, MessageSquareText, Rss, Settings, Music } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/playlists', label: 'Playlists', icon: ListMusic },
  { href: '/tracks', label: 'Tracks', icon: Music },
  { href: '/prompts', label: 'Prompts', icon: MessageSquareText },
  { href: '/feed', label: 'Feed', icon: Rss },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 flex h-16 w-full max-w-sm -translate-x-1/2 items-center justify-around rounded-t-3xl border border-white/[0.08] border-b-0 bg-bg-surface/80 px-2 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-[10px] font-medium transition-colors',
              active ? 'text-accent-gold' : 'text-text-tertiary'
            )}
          >
            <Icon size={20} />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
