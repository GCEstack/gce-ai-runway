'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/playlists': 'Playlists',
  '/prompts': 'Prompts',
  '/ratings': 'Ratings',
  '/feed': 'Feed',
  '/settings': 'Settings',
}

export default function MobileHeader({ user }: { user: User }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const displayName = user.email?.split('@')[0] ?? 'User'
  const initials = displayName.slice(0, 2).toUpperCase()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.06] bg-bg-primary/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <h1 className="font-display text-xl text-text-primary">
          {pageTitles[pathname] ?? 'Runway'}
        </h1>
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-gold to-accent-gold-dim font-heading text-xs font-semibold text-black"
        >
          {initials}
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-white/[0.08] bg-bg-surface-solid p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-2xl text-text-primary">Profile</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-text-secondary hover:bg-white/[0.06]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent-gold to-accent-gold-dim font-heading text-lg font-semibold text-black">
                {initials}
              </div>
              <div>
                <div className="text-lg font-medium text-text-primary capitalize">{displayName}</div>
                <div className="text-sm text-text-secondary">{user.email}</div>
              </div>
            </div>
            <button
              onClick={signOut}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08]',
                'bg-white/[0.04] py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary'
              )}
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  )
}
