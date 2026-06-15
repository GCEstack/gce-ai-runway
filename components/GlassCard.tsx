import { type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
  onClick?: () => void
  onMouseEnter?: (e: MouseEvent<HTMLDivElement>) => void
  onMouseLeave?: (e: MouseEvent<HTMLDivElement>) => void
  style?: CSSProperties
}

export function GlassCard({
  children,
  className,
  hover = true,
  glow = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  style,
}: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/[0.06] bg-bg-surface backdrop-blur-xl',
        hover &&
          'transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] hover:shadow-lg',
        glow && 'shadow-[0_0_40px_-12px_rgba(234,179,8,0.15)]',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}
