#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const reportPath = resolve(root, 'docs/deck-support-report.md')

const [
  testDecks,
  scryfall,
  deckSupportAudit,
  deckSupportReport,
] = await Promise.all([
  import('../src/lib/test-decks.ts'),
  import('../src/lib/scryfall.ts'),
  import('../src/lib/deck-support-audit.ts'),
  import('../src/lib/deck-support-report.ts'),
])

const builtInDecks = [
  {
    id: 'SQUIRREL_TEST_DECK',
    displayName: 'Hazel Squirrels',
    tier: 1,
    raw: testDecks.SQUIRREL_TEST_DECK,
  },
  {
    id: 'BLIGHT_TEST_DECK',
    displayName: 'Auntie Ool Blight',
    tier: 1,
    raw: testDecks.BLIGHT_TEST_DECK,
  },
]

async function resolveAndAuditDeck(deckDefinition) {
  console.log(`Resolving ${deckDefinition.id} through Scryfall...`)

  const imported = await scryfall.importDecklistText(deckDefinition.raw)
  const deck = {
    ...imported.deck,
    sourceId: deckDefinition.id,
    name: deckDefinition.displayName,
  }

  return {
    id: deckDefinition.id,
    displayName: deckDefinition.displayName,
    tier: deckDefinition.tier,
    audit: deckSupportAudit.auditImportedDeck(deck),
    importWarnings: deck.importWarnings ?? [],
    unresolvedCards: deck.unresolvedCards ?? [],
  }
}

const results = []
for (const deckDefinition of builtInDecks) {
  results.push(await resolveAndAuditDeck(deckDefinition))
}

const markdown = deckSupportReport.renderDeckSupportReport(results, new Date().toISOString())
mkdirSync(resolve(root, 'docs'), { recursive: true })
writeFileSync(reportPath, markdown, 'utf8')

console.log('')
console.log(`Wrote ${reportPath}`)
console.log('')
for (const result of results) {
  const automated = deckSupportReport.getAutomatedCount(result.audit)
  const verified = deckSupportReport.getRuntimeVerifiedCount(result.audit)
  const total = result.audit.uniqueCardCount
  const blockers = deckSupportReport.getDeckBlockerCount(result.audit)
  console.log(`${result.displayName}: ${automated}/${total} automated, ${verified}/${total} runtime-verified, ${blockers} blocker(s)`)
}
