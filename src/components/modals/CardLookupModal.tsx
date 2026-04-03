import { useState, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useCardSearch } from '@/hooks/useScryfall'
import type { ScryfallCard } from '@/types/scryfall'

interface CardLookupModalProps {
  open: boolean
  onClose: () => void
}

function CardDetail({ card }: { card: ScryfallCard }) {
  const [face, setFace] = useState(0)
  const faces = card.card_faces
  const imageUri = faces
    ? faces[face]?.image_uris?.normal
    : card.image_uris?.normal

  return (
    <div className="flex flex-col gap-3">
      {imageUri && (
        <div className="relative">
          <img src={imageUri} alt={card.name} className="w-full rounded-xl" loading="lazy" />
          {faces && faces.length > 1 && (
            <button
              onClick={() => setFace(f => (f + 1) % faces.length)}
              className="absolute bottom-2 right-2 bg-black/60 text-white px-3 py-1.5 rounded-lg text-sm"
            >
              Flip ↺
            </button>
          )}
        </div>
      )}
      <div className="text-sm text-slate-300">
        <div className="font-semibold">{card.name}</div>
        <div className="text-slate-400">{card.type_line}</div>
        {card.oracle_text && <div className="mt-1 whitespace-pre-line">{card.oracle_text}</div>}
        {card.prices?.usd && <div className="mt-1 text-slate-500 text-xs">${card.prices.usd}</div>}
      </div>
    </div>
  )
}

export function CardLookupModal({ open, onClose }: CardLookupModalProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null)
  const { data: results = [], isFetching } = useCardSearch(debouncedQuery)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setSelectedCard(null)
    const t = setTimeout(() => setDebouncedQuery(val), 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <Modal open={open} onClose={onClose} title="Card Lookup">
      <div className="p-4 flex flex-col gap-3">
        <div className="relative">
          <input
            value={query}
            onChange={handleChange}
            placeholder="Search any card…"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            autoFocus
          />
          {isFetching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner size="sm" /></div>
          )}
        </div>

        {selectedCard ? (
          <div>
            <button onClick={() => setSelectedCard(null)} className="text-sm text-slate-400 hover:text-white mb-3">
              ← Back to results
            </button>
            <CardDetail card={selectedCard} />
          </div>
        ) : (
          results.length > 0 && (
            <div className="flex flex-col gap-0.5 max-h-96 overflow-y-auto rounded-xl border border-slate-700">
              {results.map(card => (
                <button
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700 text-left transition-colors"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-sm truncate">{card.name}</span>
                    <span className="text-xs text-slate-400 truncate">{card.type_line}</span>
                  </div>
                  {card.mana_cost && <span className="ml-auto text-xs text-slate-500 flex-shrink-0">{card.mana_cost}</span>}
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </Modal>
  )
}
