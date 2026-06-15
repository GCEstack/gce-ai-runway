'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number | null
  onChange?: (value: number) => void
  readOnly?: boolean
}

export function StarRating({ value, onChange, readOnly = false }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0)
  const [bounceKey, setBounceKey] = useState<number | null>(null)

  const displayValue = hoverValue || value || 0

  const handleClick = (idx: number) => {
    if (readOnly) return
    onChange?.(idx)
    setBounceKey(idx)
    setTimeout(() => setBounceKey(null), 150)
  }

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((idx) => {
        const filled = idx <= displayValue
        return (
          <button
            key={idx}
            type="button"
            disabled={readOnly}
            onClick={() => handleClick(idx)}
            onMouseEnter={() => !readOnly && setHoverValue(idx)}
            onMouseLeave={() => !readOnly && setHoverValue(0)}
            className={cn(
              'p-0.5 transition-colors focus:outline-none',
              !readOnly && 'cursor-pointer',
              bounceKey === idx && 'star-bounce'
            )}
          >
            <Star
              size={18}
              className={cn(
                'transition-colors',
                filled
                  ? 'fill-accent-gold text-accent-gold'
                  : 'fill-transparent text-text-tertiary'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
