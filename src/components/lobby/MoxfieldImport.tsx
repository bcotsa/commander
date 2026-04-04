import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { importMoxfieldDeck } from '@/lib/moxfield'
import type { CommanderCard, ImportedDeck } from '@/types/game-state'

interface MoxfieldImportProps {
  onImport: (payload: { deck: ImportedDeck; commander: CommanderCard | null }) => void
  selectedDeck?: ImportedDeck | null
}

export function MoxfieldImport({ onImport, selectedDeck }: MoxfieldImportProps) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleImport() {
    if (!value.trim() || loading) return

    setLoading(true)
    setError(null)

    try {
      const payload = await importMoxfieldDeck(value)
      onImport(payload)
      setValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import deck')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <div>
        <p className="text-sm font-medium text-slate-200">Import from Moxfield</p>
        <p className="mt-1 text-xs text-slate-400">
          Paste a public deck URL or deck ID to save your list and auto-fill your commander.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void handleImport()}
          placeholder="https://www.moxfield.com/decks/..."
          className="flex-1"
        />
        <Button onClick={() => void handleImport()} disabled={loading || !value.trim()} className="sm:self-end">
          {loading ? 'Importing…' : 'Import Deck'}
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
          <a
            href={selectedDeck.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-xs text-violet-300 hover:text-violet-200"
          >
            Open on Moxfield
          </a>
        </div>
      )}
    </div>
  )
}
