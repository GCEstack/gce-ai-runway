import { cn } from '@/lib/utils'
import type { Agent } from '@/lib/types'

interface AgentBadgeProps {
  agent: Agent
  small?: boolean
}

export function AgentBadge({ agent, small = false }: AgentBadgeProps) {
  const isKimi = agent === 'KIMI'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-mono font-medium tracking-wider',
        small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        isKimi
          ? 'border-agent-kimi/20 bg-agent-kimi/10 text-agent-kimi'
          : 'border-agent-claude/20 bg-agent-claude/10 text-agent-claude'
      )}
    >
      {agent}
    </span>
  )
}
