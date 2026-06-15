import { cn } from '@/lib/utils'

interface FilterPillProps {
  label: string
  active?: boolean
  onClick?: () => void
}

export function FilterPill({ label, active = false, onClick }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-accent-gold/40 bg-accent-gold/10 text-accent-gold'
          : 'border-white/[0.08] bg-transparent text-text-secondary hover:border-white/[0.15] hover:text-text-primary'
      )}
    >
      {label}
    </button>
  )
}
