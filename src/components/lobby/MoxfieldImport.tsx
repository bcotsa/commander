import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ImportedDeck } from '@/types/game-state'

interface MoxfieldImportProps {
  onImportUrl: (input: string) => Promise<void> | void
  onImportDecklist: (input: string) => Promise<void> | void
  selectedDeck?: ImportedDeck | null
}

export function MoxfieldImport({ onImportUrl, onImportDecklist, selectedDeck }: MoxfieldImportProps) {
  const [urlValue, setUrlValue] = useState('')
  const [textValue, setTextValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  async function handleUrlImport() {
    if (!urlValue.trim() || loading) return

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      await onImportUrl(urlValue)
      setUrlValue('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('fetch')) {
        setError('Network error connecting to server. Check your internet connection and try again.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleTextImport() {
    if (!textValue.trim() || loading) return

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      await onImportDecklist(textValue)
      setTextValue('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('fetch')) {
        setError('Network error connecting to Scryfall. Check your internet connection and try again.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <div>
        <p className="text-sm font-medium text-slate-200">Import from Moxfield</p>
        <p className="mt-1 text-xs text-slate-400">
          Paste a public deck URL or deck ID, or paste an exported decklist below.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={urlValue}
          onChange={e => setUrlValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void handleUrlImport()}
          placeholder="https://www.moxfield.com/decks/..."
          className="flex-1"
        />
        <Button onClick={() => void handleUrlImport()} disabled={loading || !urlValue.trim()} className="sm:self-end">
          {loading ? 'Importing…' : 'Import URL'}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          value={textValue}
          onChange={e => setTextValue(e.target.value)}
          placeholder={'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n1 Arcane Signet'}
          className="min-h-40 w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <Button onClick={() => void handleTextImport()} disabled={loading || !textValue.trim()} variant="secondary">
          {loading ? 'Importing…' : 'Import Decklist'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300 select-text cursor-text">
          <span className="font-medium text-red-400">Error: </span>{error}
        </div>
      )}
      {warning && !error && (
        <div className="rounded-lg border border-amber-800 bg-amber-900/20 p-3 text-sm text-amber-300 select-text cursor-text">
          <span className="font-medium text-amber-400">Warning: </span>{warning}
        </div>
      )}

      {selectedDeck && (
        <div className="rounded-xl border border-violet-700 bg-violet-900/20 p-3">
          <div className="text-sm font-semibold text-violet-200">{selectedDeck.name}</div>
          <div className="mt-1 text-xs text-slate-300">
            {selectedDeck.cardCount} cards
            {selectedDeck.commanders[0] ? ` • Commander: ${selectedDeck.commanders[0].name}` : ''}
          </div>
          {selectedDeck.importWarnings && selectedDeck.importWarnings.length > 0 && (
            <div className="mt-2 text-xs text-amber-200 select-text cursor-text">
              {selectedDeck.importWarnings.join(' ')}
            </div>
          )}
          {selectedDeck.unresolvedCards && selectedDeck.unresolvedCards.length > 0 && (
            <div className="mt-2 text-xs text-red-200 select-text cursor-text">
              Unresolved: {selectedDeck.unresolvedCards.slice(0, 8).join(', ')}
            </div>
          )}
          {selectedDeck.sourceUrl && (
            <a
              href={selectedDeck.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-xs text-violet-300 hover:text-violet-200"
            >
              Open on Moxfield
            </a>
          )}
        </div>
      )}
    </div>
  )
}
