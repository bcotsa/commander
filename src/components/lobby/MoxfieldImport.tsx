import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { importMoxfieldDeck } from '@/lib/moxfield'
import { importDecklistText } from '@/lib/scryfall'
import type { CommanderCard, ImportedDeck } from '@/types/game-state'

interface MoxfieldImportProps {
  onImport: (payload: { deck: ImportedDeck; commander: CommanderCard | null }) => void
  selectedDeck?: ImportedDeck | null
}

export function MoxfieldImport({ onImport, selectedDeck }: MoxfieldImportProps) {
  const [urlValue, setUrlValue] = useState('')
  const [textValue, setTextValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUrlImport() {
    if (!urlValue.trim() || loading) return

    setLoading(true)
    setError(null)

    try {
      const payload = await importMoxfieldDeck(urlValue)
      onImport(payload)
      setUrlValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import deck')
    } finally {
      setLoading(false)
    }
  }

  async function handleTextImport() {
    if (!textValue.trim() || loading) return

    setLoading(true)
    setError(null)

    try {
      const payload = await importDecklistText(textValue)
      onImport(payload)
      setTextValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import decklist')
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

      {error && <p className="text-sm text-red-400">{error}</p>}

      {selectedDeck && (
        <div className="rounded-xl border border-violet-700 bg-violet-900/20 p-3">
          <div className="text-sm font-semibold text-violet-200">{selectedDeck.name}</div>
          <div className="mt-1 text-xs text-slate-300">
            {selectedDeck.cardCount} cards
            {selectedDeck.commanders[0] ? ` • Commander: ${selectedDeck.commanders[0].name}` : ''}
          </div>
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
