import type { ScryfallCard, ScryfallSearchResult } from '@/types/scryfall'
import type { CommanderCard, ColorSymbol, ImportedDeck, ImportedDeckCard, TokenTemplateKey } from '@/types/game-state'

const BASE = 'https://api.scryfall.com'
const TOKEN_QUERY_BY_KEY: Record<TokenTemplateKey, string> = {
  treasure: '"Treasure" t:token',
  food: '"Food" t:token',
  clue: '"Clue" t:token',
  map: '"Map" t:token',
  squirrel: '"Squirrel" t:token',
  rat: '"Rat" t:token',
  insect: '"Insect" t:token',
  zombie: '"Zombie" t:token',
  snake: '"Snake" t:token',
  pest: '"Pest" t:token',
}
const tokenImageCache = new Map<TokenTemplateKey, string>()
const tokenImageInflight = new Map<TokenTemplateKey, Promise<string>>()

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

export async function getTokenImageUri(tokenKey: TokenTemplateKey): Promise<string> {
  const cached = tokenImageCache.get(tokenKey)
  if (cached !== undefined) return cached

  const inflight = tokenImageInflight.get(tokenKey)
  if (inflight) return inflight

  const query = TOKEN_QUERY_BY_KEY[tokenKey]
  const promise = (async () => {
    try {
      const q = encodeURIComponent(query)
      const res = await fetch(`${BASE}/cards/search?q=${q}&include_extras=true&unique=art&order=released`)
      if (!res.ok) {
        tokenImageCache.set(tokenKey, '')
        return ''
      }
      const data: ScryfallSearchResult = await res.json()
      const card = data.data?.[0]
      const imageUri =
        card?.image_uris?.normal ??
        card?.card_faces?.[0]?.image_uris?.normal ??
        ''
      tokenImageCache.set(tokenKey, imageUri)
      return imageUri
    } catch {
      tokenImageCache.set(tokenKey, '')
      return ''
    } finally {
      tokenImageInflight.delete(tokenKey)
    }
  })()

  tokenImageInflight.set(tokenKey, promise)
  return promise
}

export interface CardLookupResult {
  cards: Map<string, ScryfallCard>
  errors: string[]
}

export async function getCardsByNames(names: string[]): Promise<CardLookupResult> {
  const uniqueNames = [...new Set(names.map(name => name.trim()).filter(Boolean))]
  const cards = new Map<string, ScryfallCard>()
  const errors: string[] = []

  // Scryfall's Collection endpoint accepts up to 75 identifiers per request.
  const BATCH_SIZE = 75
  for (let i = 0; i < uniqueNames.length; i += BATCH_SIZE) {
    const batch = uniqueNames.slice(i, i + BATCH_SIZE)
    const identifiers = batch.map(name => ({ name }))
    const batchLabel = `batch ${Math.floor(i / BATCH_SIZE) + 1}`

    let res: Response | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        res = await fetch(`${BASE}/cards/collection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiers }),
        })
        if (res.ok) break
        if (res.status === 429) {
          // Rate limited — wait and retry
          await new Promise(r => setTimeout(r, 1000))
          res = null
          continue
        }
        errors.push(`Scryfall returned ${res.status} for ${batchLabel} (${batch.length} cards)`)
        res = null
        break
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 500))
          continue
        }
        errors.push(`Network error looking up ${batchLabel}: ${msg}`)
        res = null
      }
    }

    if (res?.ok) {
      try {
        const data = await res.json() as { data: ScryfallCard[]; not_found: { name?: string }[] }
        for (const card of data.data) {
          cards.set(card.name.toLowerCase(), card)
        }
      } catch {
        errors.push(`Failed to parse Scryfall response for ${batchLabel}`)
      }
    }

    // Respect Scryfall's rate limit between batches
    if (i + BATCH_SIZE < uniqueNames.length) {
      await new Promise(r => setTimeout(r, 100))
    }
  }

  return { cards, errors }
}

/**
 * Attempt fuzzy lookup for cards that weren't found by exact name.
 * Returns any successfully resolved cards.
 */
async function fuzzyFallback(names: string[]): Promise<Map<string, ScryfallCard>> {
  const results = new Map<string, ScryfallCard>()
  for (const name of names) {
    try {
      const card = await getCardByName(name)
      if (card) {
        results.set(name.toLowerCase(), card)
      }
    } catch {
      // skip
    }
    // Respect Scryfall rate limit (100ms between requests)
    await new Promise(r => setTimeout(r, 100))
  }
  return results
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
    oracleText: card.oracle_text ?? card.card_faces?.map(face => face.oracle_text ?? '').join('\n') ?? null,
    typeLine: card.type_line,
    power: parseCardStat(card.power ?? card.card_faces?.[0]?.power),
    toughness: parseCardStat(card.toughness ?? card.card_faces?.[0]?.toughness),
  }
}

function parseCardStat(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

type ParsedDeckLine = {
  quantity: number
  name: string
  section: 'commander' | 'mainboard'
}

function isLikelyCommander(card: ScryfallCard): boolean {
  const typeLine = card.type_line.toLowerCase()
  const oracleText = (card.oracle_text ?? card.card_faces?.map(face => face.oracle_text ?? '').join('\n') ?? '').toLowerCase()

  if (typeLine.includes('legendary') && typeLine.includes('creature')) return true
  return oracleText.includes('can be your commander')
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

  const { cards: resolvedCards, errors: lookupErrors } = await getCardsByNames(parsed.map(card => card.name))
  let unresolved = parsed.filter(card => !resolvedCards.has(card.name.toLowerCase()))

  // Fuzzy fallback for cards not found by exact name (handles typos / alternate names)
  if (unresolved.length > 0 && unresolved.length <= 20) {
    const fuzzyResults = await fuzzyFallback(unresolved.map(card => card.name))
    for (const [key, card] of fuzzyResults) {
      resolvedCards.set(key, card)
    }
    const stillMissing = unresolved.filter(card => !resolvedCards.has(card.name.toLowerCase()))
    if (fuzzyResults.size > 0) {
      const fuzzyNames = [...fuzzyResults.values()].map(c => c.name)
      lookupErrors.push(`Fuzzy-matched ${fuzzyResults.size} card(s): ${fuzzyNames.join(', ')}`)
    }
    unresolved = stillMissing
  }

  const commanders = parsed
    .filter(card => card.section === 'commander')
    .filter(card => resolvedCards.has(card.name.toLowerCase()))
    .map(card => scryfallCardToImportedDeckCard(resolvedCards.get(card.name.toLowerCase())!, card.quantity))

  const mainboard = parsed
    .filter(card => card.section === 'mainboard')
    .filter(card => resolvedCards.has(card.name.toLowerCase()))
    .map(card => scryfallCardToImportedDeckCard(resolvedCards.get(card.name.toLowerCase())!, card.quantity))

  if (commanders.length === 0 && mainboard.length === 0) {
    const details = lookupErrors.length > 0
      ? lookupErrors.join('; ')
      : `Could not find: ${unresolved.slice(0, 5).map(card => card.name).join(', ')}`
    throw new Error(`No cards could be resolved. ${details}`)
  }

  let inferredCommander = commanders[0] ?? null

  if (!inferredCommander) {
    const commanderCandidates = parsed
      .map(card => ({
        parsed: card,
        resolved: resolvedCards.get(card.name.toLowerCase()) ?? null,
      }))
      .filter((entry): entry is { parsed: ParsedDeckLine; resolved: ScryfallCard } => Boolean(entry.resolved))
      .filter(entry => isLikelyCommander(entry.resolved))

    const lastCandidate = commanderCandidates[commanderCandidates.length - 1]
    if (lastCandidate) {
      inferredCommander = scryfallCardToImportedDeckCard(lastCandidate.resolved, lastCandidate.parsed.quantity)
    }
  }

  const warnings: string[] = []
  if (lookupErrors.length > 0) {
    warnings.push(...lookupErrors)
  }
  if (unresolved.length > 0) {
    warnings.push(`${unresolved.length} card(s) not found: ${unresolved.slice(0, 8).map(card => card.name).join(', ')}`)
  }
  const resolvedCount = commanders.length + mainboard.reduce((sum, c) => sum + c.quantity, 0)
  const totalCount = parsed.reduce((sum, c) => sum + c.quantity, 0)
  if (resolvedCount < totalCount) {
    warnings.push(`Imported ${resolvedCount} of ${totalCount} cards`)
  }
  if (!commanders.length && inferredCommander) {
    warnings.push(`Inferred commander from decklist: ${inferredCommander.name}`)
  }
  if (!commanders.length && !inferredCommander) {
    warnings.push('No commander section found, and no commander could be inferred')
  }

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
      unresolvedCards: unresolved.map(card => card.name),
      importWarnings: warnings,
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
