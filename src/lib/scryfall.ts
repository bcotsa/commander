import type { ScryfallCard, ScryfallSearchResult } from '@/types/scryfall'
import type { CommanderCard, ColorSymbol } from '@/types/game-state'

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

export function colorIdentityLabel(colors: ColorSymbol[]): string {
  if (colors.length === 0) return 'Colorless'
  const names: Record<ColorSymbol, string> = {
    W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless'
  }
  return colors.map(c => names[c]).join('/')
}
