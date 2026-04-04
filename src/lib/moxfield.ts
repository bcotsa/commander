import { supabase } from '@/lib/supabase'
import type { CommanderCard, ImportedDeck } from '@/types/game-state'

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
    throw new Error(error.message || 'Unable to import Moxfield deck')
  }

  if (!data?.deck) {
    throw new Error('Unable to import Moxfield deck')
  }

  return data
}
