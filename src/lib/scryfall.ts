import type { ScryfallCard, ScryfallSearchResult } from '@/types/scryfall'
import type { CommanderCard, ColorSymbol, ImportedDeck, ImportedDeckCard } from '@/types/game-state'

const BASE = 'https://api.scryfall.com'

export async function searchCommanders(query: string): Promise<ScryfallCard[]> {
  if (!query.trim()) return []
  const q = encodeURIComponent(`is:commander game:paper name:${query}`)
  const res = await fetch(`${BASE}/cards/search?q=${q}&order=name&unique=cards`)
  if (!res.ok) return []
  const data: ScryfallSearchResult = await res.json()
  return data.data ?? []
}

export async function searchCards(query: string): Promise<ScryfallCard[]> {
  if (!query.trim()) return []
  const q = encodeURIComponent(`game:paper ${query}`)
  const res = await fetch(`${BASE}/cards/search?q=${q}&order=name&unique=cards`)
  if (!res.ok) return []
  const data: ScryfallSearchResult = await res.json()
  return data.data ?? []
}

export async function getCardByName(name: string): Promise<ScryfallCard | null> {
  const res = await fetch(`${BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`)
  if (!res.ok) return null
  return res.json()
}

export async function getCardsByNames(names: string[]): Promise<Map<string, ScryfallCard>> {
  const uniqueNames = [...new Set(names.map(name => name.trim()).filter(Boolean))]
  const cards = new Map<string, ScryfallCard>()

  for (const name of uniqueNames) {
    const card = await getCardByName(name)
    if (card) cards.set(name.toLowerCase(), card)
  }

  return cards
}

export function scryfallCardToCommander(card: ScryfallCard): CommanderCard {
  // Handle double-faced cards
  const imageUri =
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.normal ??
    ''

  return {
    scryfallId: card.id,
    name: card.name,
    imageUri,
    colorIdentity: card.color_identity as ColorSymbol[],
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? null,
    typeLine: card.type_line,
  }
}

export function scryfallCardToImportedDeckCard(card: ScryfallCard, quantity: number): ImportedDeckCard {
  const imageUri =
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.normal ??
    ''

  return {
    scryfallId: card.id,
    name: card.name,
    quantity,
    imageUri,
    colorIdentity: card.color_identity as ColorSymbol[],
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? null,
    typeLine: card.type_line,
  }
}

type ParsedDeckLine = {
  quantity: number
  name: string
  section: 'commander' | 'mainboard'
}

function sanitizeDeckCardName(raw: string): string {
  return raw
    .replace(/\s+\([^)]*\)\s*\d+[A-Za-z]*$/u, '')
    .replace(/\s+\[[^\]]+\]\s*$/u, '')
    .trim()
}

function parseDecklistLine(line: string, section: ParsedDeckLine['section']): ParsedDeckLine | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('//')) return null

  const match = trimmed.match(/^(\d+)\s+(.+)$/u)
  if (!match) return null

  const quantity = Number(match[1])
  const name = sanitizeDeckCardName(match[2] ?? '')
  if (!Number.isFinite(quantity) || quantity <= 0 || !name) return null

  return { quantity, name, section }
}

export async function importDecklistText(raw: string): Promise<{
  deck: ImportedDeck
  commander: CommanderCard | null
}> {
  const text = raw.trim()
  if (!text) throw new Error('Paste a decklist to import')

  const lines = text.split(/\r?\n/u)
  let currentSection: ParsedDeckLine['section'] = 'mainboard'
  const parsed: ParsedDeckLine[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const normalized = trimmed.toLowerCase()
    if (normalized === 'commander' || normalized === 'commanders') {
      currentSection = 'commander'
      continue
    }
    if (normalized === 'deck' || normalized === 'mainboard' || normalized === 'main') {
      currentSection = 'mainboard'
      continue
    }

    const parsedLine = parseDecklistLine(trimmed, currentSection)
    if (parsedLine) parsed.push(parsedLine)
  }

  if (parsed.length === 0) {
    throw new Error('No cards found in the pasted decklist')
  }

  const resolvedCards = await getCardsByNames(parsed.map(card => card.name))
  const unresolved = parsed.filter(card => !resolvedCards.has(card.name.toLowerCase()))
  if (unresolved.length > 0) {
    throw new Error(`Could not find: ${unresolved.slice(0, 3).map(card => card.name).join(', ')}`)
  }

  const commanders = parsed
    .filter(card => card.section === 'commander')
    .map(card => scryfallCardToImportedDeckCard(resolvedCards.get(card.name.toLowerCase())!, card.quantity))

  const mainboard = parsed
    .filter(card => card.section === 'mainboard')
    .map(card => scryfallCardToImportedDeckCard(resolvedCards.get(card.name.toLowerCase())!, card.quantity))

  const inferredCommander = commanders[0] ?? (mainboard.length === 100 ? mainboard[0] : null)

  return {
    deck: {
      source: 'moxfield',
      sourceId: `text-${crypto.randomUUID()}`,
      sourceUrl: '',
      name: 'Imported Decklist',
      format: 'commander',
      lastSyncedAt: new Date().toISOString(),
      cardCount: mainboard.reduce((sum, card) => sum + card.quantity, 0),
      commanders,
      mainboard,
    },
    commander: inferredCommander
      ? {
          scryfallId: inferredCommander.scryfallId ?? '',
          name: inferredCommander.name,
          imageUri: inferredCommander.imageUri,
          colorIdentity: inferredCommander.colorIdentity,
          manaCost: inferredCommander.manaCost,
          typeLine: inferredCommander.typeLine,
        }
      : null,
  }
}

export function colorIdentityLabel(colors: ColorSymbol[]): string {
  if (colors.length === 0) return 'Colorless'
  const names: Record<ColorSymbol, string> = {
    W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless'
  }
  return colors.map(c => names[c]).join('/')
}
