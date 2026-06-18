import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SideNav from '@/components/nav'
import MobileHeader from '@/components/MobileHeader'
import BottomNav from '@/components/BottomNav'
import { AuroraBackground } from '@/components/AuroraBackground'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="relative min-h-screen bg-bg-primary">
      <AuroraBackground />
      <SideNav user={user} />
      <MobileHeader user={user} />
      <main className="custom-scrollbar relative z-10 min-h-screen pb-24 lg:ml-60 lg:pb-8">
        <div className="mx-auto max-w-7xl p-4 lg:p-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  )
}
