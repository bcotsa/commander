import type { ColorSymbol } from '@/types/game-state'

const COLOR_STYLES: Record<ColorSymbol, string> = {
  W: 'bg-yellow-50 text-yellow-900',
  U: 'bg-blue-500 text-white',
  B: 'bg-slate-900 text-slate-200 border border-slate-600',
  R: 'bg-red-600 text-white',
  G: 'bg-green-600 text-white',
  C: 'bg-slate-500 text-white',
}

const COLOR_LETTERS: Record<ColorSymbol, string> = {
  W: 'W', U: 'U', B: 'B', R: 'R', G: 'G', C: 'C'
}

interface ColorPipsProps {
  colors: ColorSymbol[]
  size?: 'sm' | 'md'
}

export function ColorPips({ colors, size = 'sm' }: ColorPipsProps) {
  if (colors.length === 0) {
    colors = ['C']
  }
  const sz = size === 'sm' ? 'w-4 h-4 text-[10px]' : 'w-6 h-6 text-xs'
  return (
    <div className="flex gap-0.5">
      {colors.map((c) => (
        <span
          key={c}
          className={`${sz} ${COLOR_STYLES[c]} rounded-full flex items-center justify-center font-bold`}
        >
          {COLOR_LETTERS[c]}
        </span>
      ))}
    </div>
  )
}
