import { supabase } from '@/lib/supabase'
import type { CommanderCard, ImportedDeck } from '@/types/game-state'
import { FunctionsHttpError } from '@supabase/supabase-js'

export async function importMoxfieldDeck(input: string): Promise<{
  deck: ImportedDeck
  commander: CommanderCard | null
}> {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Enter a valid Moxfield deck URL or deck ID')

  const { data, error } = await supabase.functions.invoke<{
    deck: ImportedDeck
    commander: CommanderCard | null
  }>('import-moxfield', {
    body: { input: trimmed },
  })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.json() as { error?: string }
        throw new Error(payload.error || 'Unable to import Moxfield deck')
      } catch {
        throw new Error('Unable to import Moxfield deck')
      }
    }
    throw new Error(error.message || 'Unable to import Moxfield deck')
  }

  if (!data?.deck) {
    throw new Error('Unable to import Moxfield deck')
  }

  return data
}
