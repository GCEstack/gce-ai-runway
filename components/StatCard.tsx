import { type LucideIcon } from 'lucide-react'
import { GlassCard } from './GlassCard'

interface StatCardProps {
  icon: LucideIcon
  iconColor: string
  value: string | number
  label: string
}

export function StatCard({ icon: Icon, iconColor, value, label }: StatCardProps) {
  return (
    <div className="stat-card-3d" style={{ perspective: '800px' }}>
      <GlassCard glow className="p-5">
        <div className="mb-4 flex justify-end">
          <Icon size={22} style={{ color: iconColor }} />
        </div>
        <div className="font-display text-3xl text-text-primary">{value}</div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          {label}
        </div>
      </GlassCard>
    </div>
  )
}
