import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SideNav from '@/components/nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <SideNav user={user} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
