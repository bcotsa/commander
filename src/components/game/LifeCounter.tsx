import { useState } from 'react'
import { useLongPress } from '@/hooks/useLongPress'

interface LifeCounterProps {
  life: number
  eliminated: boolean
  onDelta: (delta: number) => void
  rotated?: boolean
  compact?: boolean
}

export function LifeCounter({ life, eliminated, onDelta, rotated, compact = false }: LifeCounterProps) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  function trigger(delta: number) {
    if (eliminated) return
    onDelta(delta)
    setFlash(delta > 0 ? 'up' : 'down')
    setTimeout(() => setFlash(null), 300)
    if ('vibrate' in navigator) navigator.vibrate(15)
  }

  const upPress = useLongPress({ onPress: () => trigger(1), onLongPress: () => trigger(5) })
  const downPress = useLongPress({ onPress: () => trigger(-1), onLongPress: () => trigger(-5) })

  const lifeColor =
    eliminated ? 'text-slate-600' :
    life <= 0 ? 'text-red-500' :
    life <= 10 ? 'text-orange-400' :
    life <= 20 ? 'text-yellow-300' :
    'text-white'

  return (
    <div className={`flex flex-col h-full select-none touch-callout-none ${rotated ? 'rotate-180' : ''}`}>
      {/* Increase */}
      <button
        {...upPress}
        className={`flex-1 flex items-center justify-center text-slate-400 hover:text-green-400 active:bg-green-900/20 transition-colors rounded-t-xl ${compact ? 'text-lg' : 'text-2xl'}`}
        aria-label="Increase life"
      >
        ▲
      </button>

      {/* Life total */}
      <div className={`text-center py-1 transition-all ${flash === 'up' ? 'scale-110 text-green-400' : flash === 'down' ? 'scale-110 text-red-400' : ''}`}>
        <span className={`font-bold tabular-nums leading-none ${lifeColor} ${compact ? 'text-4xl' : Math.abs(life) >= 100 ? 'text-5xl' : 'text-7xl'}`}>
          {life}
        </span>
      </div>

      {/* Decrease */}
      <button
        {...downPress}
        className={`flex-1 flex items-center justify-center text-slate-400 hover:text-red-400 active:bg-red-900/20 transition-colors rounded-b-xl ${compact ? 'text-lg' : 'text-2xl'}`}
        aria-label="Decrease life"
      >
        ▼
      </button>
    </div>
  )
}
