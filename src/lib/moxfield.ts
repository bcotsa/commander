import type { CommanderCard, ImportedDeck, ImportedDeckCard, ColorSymbol } from '@/types/game-state'

const MOXFIELD_API_BASES = [
  'https://api2.moxfield.com/v3',
  'https://api2.moxfield.com/v2',
] as const

type MoxfieldDeckCardRecord = {
  quantity?: number
  count?: number
  card?: {
    id?: string
    scryfall_id?: string
    oracle_id?: string
    name?: string
    mana_cost?: string
    manaCost?: string
    type_line?: string
    typeLine?: string
    color_identity?: string[]
    colorIdentity?: string[]
    image_uris?: { normal?: string; small?: string }
    imageUrl?: string
    card_faces?: Array<{
      image_uris?: { normal?: string; small?: string }
      mana_cost?: string
    }>
  }
}

type MoxfieldDeckResponse = {
  id?: string
  publicId?: string
  name?: string
  format?: string
  mainboard?: Record<string, MoxfieldDeckCardRecord>
  commanders?: Record<string, MoxfieldDeckCardRecord>
}

function extractDeckId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    const parts = url.pathname.split('/').filter(Boolean)
    const deckIndex = parts.findIndex(part => part === 'decks')
    if (deckIndex >= 0 && parts[deckIndex + 1]) return parts[deckIndex + 1]
  } catch {
    // Treat bare input as a deck id.
  }

  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null
}

function normalizeColors(colors: string[] | undefined): ColorSymbol[] {
  if (!Array.isArray(colors)) return []
  return colors.filter((color): color is ColorSymbol =>
    ['W', 'U', 'B', 'R', 'G', 'C'].includes(color)
  )
}

function normalizeDeckCard(record: MoxfieldDeckCardRecord): ImportedDeckCard | null {
  const card = record.card
  if (!card) return null

  const name = card.name?.trim()
  if (!name) return null

  const imageUri =
    card.image_uris?.normal ??
    card.image_uris?.small ??
    card.card_faces?.[0]?.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.small ??
    card.imageUrl ??
    ''

  return {
    scryfallId: card.scryfall_id ?? card.id ?? null,
    name,
    quantity: Math.max(1, record.quantity ?? record.count ?? 1),
    imageUri,
    colorIdentity: normalizeColors(card.color_identity ?? card.colorIdentity),
    manaCost: card.mana_cost ?? card.manaCost ?? card.card_faces?.[0]?.mana_cost ?? null,
    typeLine: card.type_line ?? card.typeLine ?? '',
  }
}

function toCommanderCard(card: ImportedDeckCard): CommanderCard {
  return {
    scryfallId: card.scryfallId ?? '',
    name: card.name,
    imageUri: card.imageUri,
    colorIdentity: card.colorIdentity,
    manaCost: card.manaCost,
    typeLine: card.typeLine,
  }
}

async function fetchDeckById(deckId: string): Promise<MoxfieldDeckResponse> {
  let lastError: Error | null = null

  for (const base of MOXFIELD_API_BASES) {
    try {
      const res = await fetch(`${base}/decks/all/${deckId}`)
      if (!res.ok) {
        lastError = new Error(`Moxfield returned ${res.status}`)
        continue
      }

      return await res.json() as MoxfieldDeckResponse
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unable to reach Moxfield')
    }
  }

  throw lastError ?? new Error('Unable to import Moxfield deck')
}

export async function importMoxfieldDeck(input: string): Promise<{
  deck: ImportedDeck
  commander: CommanderCard | null
}> {
  const deckId = extractDeckId(input)
  if (!deckId) throw new Error('Enter a valid Moxfield deck URL or deck ID')

  const response = await fetchDeckById(deckId)
  const mainboard = Object.values(response.mainboard ?? {})
    .map(normalizeDeckCard)
    .filter((card): card is ImportedDeckCard => Boolean(card))
  const commanders = Object.values(response.commanders ?? {})
    .map(normalizeDeckCard)
    .filter((card): card is ImportedDeckCard => Boolean(card))

  if (mainboard.length === 0 && commanders.length === 0) {
    throw new Error('This Moxfield deck did not return any cards')
  }

  const deck: ImportedDeck = {
    source: 'moxfield',
    sourceId: response.id ?? response.publicId ?? deckId,
    sourceUrl: `https://www.moxfield.com/decks/${response.id ?? response.publicId ?? deckId}`,
    name: response.name?.trim() || 'Imported Moxfield Deck',
    format: response.format ?? null,
    lastSyncedAt: new Date().toISOString(),
    cardCount: mainboard.reduce((sum, card) => sum + card.quantity, 0),
    commanders,
    mainboard,
  }

  return {
    deck,
    commander: commanders[0] ? toCommanderCard(commanders[0]) : null,
  }
}
