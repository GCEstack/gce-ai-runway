'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  ListMusic,
  MessageSquareText,
  Star,
  Rss,
  Settings,
  LogOut,
  Music,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/playlists', label: 'Playlists', icon: ListMusic },
  { href: '/tracks', label: 'Tracks', icon: Music },
  { href: '/prompts', label: 'Prompts', icon: MessageSquareText },
  { href: '/ratings', label: 'Ratings', icon: Star },
  { href: '/feed', label: 'Feed', icon: Rss },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function SideNav({ user }: { user: User }) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName = user.email?.split('@')[0] ?? 'User'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-60 flex-col border-r border-l-0 border-white/[0.06] border-l-accent-gold/30 bg-bg-primary/70 backdrop-blur-[20px] lg:flex">
      <div className="p-6">
        <div className="mb-1 font-display text-2xl text-text-primary">Runway</div>
        <div className="text-xs font-medium uppercase tracking-widest text-text-tertiary">
          Music Discovery
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border border-accent-gold/30 bg-accent-gold/10 text-accent-gold'
                  : 'border border-transparent text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/[0.06] p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent-gold to-accent-gold-dim font-heading text-sm font-semibold text-black">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-text-primary capitalize">
              {displayName}
            </div>
            <div className="truncate text-xs text-text-tertiary">{user.email}</div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-white/[0.04] hover:text-text-primary"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
