import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const testDecksSource = readFileSync(resolve(root, 'src/lib/test-decks.ts'), 'utf8')
const cardSupportSource = readFileSync(resolve(root, 'src/lib/card-support/index.ts'), 'utf8')

function normalize(name) {
  return name.trim().toLowerCase()
}

function parseDecklist(raw) {
  const cards = []
  let section = 'mainboard'

  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const lower = trimmed.toLowerCase()
    if (lower === 'commander' || lower === 'commanders') {
      section = 'commander'
      continue
    }
    if (lower === 'deck' || lower === 'mainboard' || lower === 'main') {
      section = 'mainboard'
      continue
    }

    const match = trimmed.match(/^(\d+)\s+(.+)$/u)
    if (!match) continue
    cards.push({
      quantity: Number(match[1]),
      name: match[2].trim(),
      section,
    })
  }

  return cards
}

function extractBuiltInDecks(source) {
  const decks = []
  const pattern = /export const ([A-Z_]+_TEST_DECK) = `([\s\S]*?)`/gu
  let match = pattern.exec(source)
  while (match) {
    decks.push({
      id: match[1],
      cards: parseDecklist(match[2]),
    })
    match = pattern.exec(source)
  }
  return decks
}

function extractBespokeNames(source) {
  const names = new Set()
  const blocks = source.matchAll(/cardNames:\s*\[([\s\S]*?)\]/gu)
  for (const block of blocks) {
    const strings = block[1].matchAll(/'([^']+)'|"([^"]+)"/gu)
    for (const value of strings) {
      names.add(value[1] ?? value[2])
    }
  }
  return names
}

const builtInDecks = extractBuiltInDecks(testDecksSource)
const bespokeNames = extractBespokeNames(cardSupportSource)
const bespokeLookup = new Set([...bespokeNames].map(normalize))
const staticCoreNames = new Set(['plains', 'island', 'swamp', 'mountain', 'forest'])

console.log('Commander deck support audit')
console.log('Mode: static built-in decklist vs bespoke registry')
console.log('Note: run an imported/resolved deck through auditImportedDeck for full Oracle-text classification.')
console.log('')

for (const deck of builtInDecks) {
  const uniqueCards = [...new Map(deck.cards.map(card => [normalize(card.name), card])).values()]
  const bespokeHits = uniqueCards.filter(card => bespokeLookup.has(normalize(card.name)))
  const staticCoreHits = uniqueCards.filter(card => staticCoreNames.has(normalize(card.name)))
  const queue = uniqueCards.filter(card => !bespokeLookup.has(normalize(card.name)) && !staticCoreNames.has(normalize(card.name)))

  console.log(`${deck.id}`)
  console.log(`  Cards: ${deck.cards.reduce((sum, card) => sum + card.quantity, 0)} total, ${uniqueCards.length} unique`)
  console.log(`  Bespoke registry hits: ${bespokeHits.length}`)
  if (bespokeHits.length > 0) {
    console.log(`    ${bespokeHits.map(card => card.name).join(', ')}`)
  }
  console.log(`  Static core hits: ${staticCoreHits.length}`)
  if (staticCoreHits.length > 0) {
    console.log(`    ${staticCoreHits.map(card => card.name).join(', ')}`)
  }
  console.log(`  Coverage queue candidates: ${queue.length}`)
  console.log(`    ${queue.slice(0, 20).map(card => card.name).join(', ')}${queue.length > 20 ? ', ...' : ''}`)
  console.log('')
}

console.log(`Bespoke registry cards: ${bespokeNames.size}`)
console.log([...bespokeNames].sort((a, b) => a.localeCompare(b)).join(', '))
