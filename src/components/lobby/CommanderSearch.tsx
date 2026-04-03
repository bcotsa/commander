import { useState, useCallback } from 'react'
import { useCommanderSearch } from '@/hooks/useScryfall'
import { scryfallCardToCommander } from '@/lib/scryfall'
import { ColorPips } from '@/components/ui/ColorPips'
import { Spinner } from '@/components/ui/Spinner'
import type { CommanderCard } from '@/types/game-state'

interface CommanderSearchProps {
  onSelect: (card: CommanderCard) => void
  selected?: CommanderCard | null
}

export function CommanderSearch({ onSelect, selected }: CommanderSearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const { data: results = [], isFetching } = useCommanderSearch(debouncedQuery)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    const t = setTimeout(() => setDebouncedQuery(val), 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          value={query}
          onChange={handleChange}
          placeholder="Search commanders…"
          className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        {isFetching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </div>
        )}
      </div>

      {selected && !query && (
        <div className="flex items-center gap-3 p-3 bg-violet-900/30 border border-violet-700 rounded-xl">
          {selected.imageUri && (
            <img
              src={selected.imageUri}
              alt={selected.name}
              className="w-10 h-14 rounded-md object-cover"
              loading="lazy"
            />
          )}
          <div>
            <div className="font-semibold text-sm">{selected.name}</div>
            <ColorPips colors={selected.colorIdentity} />
          </div>
          <button
            onClick={() => onSelect({ ...selected })}
            className="ml-auto text-slate-400 hover:text-red-400 text-xl"
          >
            ×
          </button>
        </div>
      )}

      {results.length > 0 && query && (
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto rounded-xl border border-slate-700">
          {results.map(card => (
            <button
              key={card.id}
              onClick={() => {
                onSelect(scryfallCardToCommander(card))
                setQuery('')
                setDebouncedQuery('')
              }}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700 text-left transition-colors"
            >
              {(card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small) && (
                <img
                  src={card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small}
                  alt={card.name}
                  className="w-8 h-11 rounded object-cover flex-shrink-0"
                  loading="lazy"
                />
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-sm truncate">{card.name}</span>
                <span className="text-xs text-slate-400 truncate">{card.type_line}</span>
              </div>
              <div className="ml-auto flex-shrink-0">
                <ColorPips colors={card.color_identity as import('@/types/game-state').ColorSymbol[]} />
              </div>
            </button>
          ))}
        </div>
      )}

      {query && debouncedQuery && results.length === 0 && !isFetching && (
        <p className="text-sm text-slate-500 text-center py-4">No commanders found</p>
      )}
    </div>
  )
}
