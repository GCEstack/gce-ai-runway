import { cn } from '@/lib/utils'
import type { Service } from '@/lib/types'

interface ServiceBadgeProps {
  service: Service
  small?: boolean
}

export function ServiceBadge({ service, small = false }: ServiceBadgeProps) {
  const isSpotify = service === 'spotify'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium capitalize',
        small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        isSpotify
          ? 'bg-green-500/10 text-green-400'
          : 'bg-cyan-500/10 text-cyan-400'
      )}
    >
      {service}
    </span>
  )
}
