import type { CardSupportAudit, CardSupportLevel, DeckSupportAudit } from './deck-support-audit.ts'

export type DeckImportanceTier = 1 | 2 | 3

export interface BuiltInDeckSupportResult {
  id: string
  displayName: string
  tier: DeckImportanceTier
  audit: DeckSupportAudit
  importWarnings: string[]
  unresolvedCards: string[]
}

export interface TopGap {
  deckId: string
  deckName: string
  tier: DeckImportanceTier
  card: CardSupportAudit
  score: number
}

const SUPPORT_LABELS: Record<CardSupportLevel, string> = {
  automated: 'Automated',
  partial: 'Partial',
  manual: 'Manual',
  unsupported: 'Unsupported',
}

function pct(value: number, total: number): string {
  if (total === 0) return '0.0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

function escapeCell(value: string): string {
  return value.replace(/\|/gu, '\\|').replace(/\n/gu, '<br>')
}

function supportWeight(level: CardSupportLevel): number {
  switch (level) {
    case 'unsupported':
      return 100
    case 'manual':
      return 50
    case 'partial':
      return 25
    case 'automated':
      return 0
  }
}

function roleWeight(card: CardSupportAudit): number {
  switch (card.role) {
    case 'commander':
      return 80
    case 'engine':
    case 'wincon':
      return 40
    case 'mana':
    case 'removal':
    case 'draw':
      return 25
    case 'combat':
      return 10
    case 'utility':
      return 0
  }
}

function tierWeight(tier: DeckImportanceTier): number {
  return tier === 1 ? 3 : tier === 2 ? 2 : 1
}

export function getDeckBlockerCount(audit: DeckSupportAudit): number {
  return audit.cards.filter(card => card.supportLevel === 'unsupported' || (card.section === 'commander' && card.supportLevel !== 'automated')).length
}

export function getRuntimeVerifiedCount(audit: DeckSupportAudit): number {
  return audit.cards.filter(card => card.confidence === 'runtime-verified').length
}

export function getAutomatedCount(audit: DeckSupportAudit): number {
  return audit.summary.automated.unique
}

export function getTopCoverageGaps(results: BuiltInDeckSupportResult[], limit = 10): TopGap[] {
  return results
    .flatMap(result =>
      result.audit.cards
        .filter(card => card.supportLevel !== 'automated')
        .map(card => ({
          deckId: result.id,
          deckName: result.displayName,
          tier: result.tier,
          card,
          score: (supportWeight(card.supportLevel) + roleWeight(card) + card.quantity) * tierWeight(result.tier),
        }))
    )
    .sort((a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name))
    .slice(0, limit)
}

function renderSummaryTable(results: BuiltInDeckSupportResult[]): string[] {
  const lines = [
    '| Deck | Tier | Cards | Unique | Automated | Runtime Verified | Partial | Manual | Unsupported | Blockers |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ]

  for (const result of results) {
    const total = result.audit.uniqueCardCount
    lines.push([
      result.displayName,
      String(result.tier),
      String(result.audit.cardCount),
      String(total),
      `${result.audit.summary.automated.unique} (${pct(result.audit.summary.automated.unique, total)})`,
      `${getRuntimeVerifiedCount(result.audit)} (${pct(getRuntimeVerifiedCount(result.audit), total)})`,
      String(result.audit.summary.partial.unique),
      String(result.audit.summary.manual.unique),
      String(result.audit.summary.unsupported.unique),
      String(getDeckBlockerCount(result.audit)),
    ].map(escapeCell).join(' | ').replace(/^/u, '| ').replace(/$/u, ' |'))
  }

  return lines
}

function renderCardRows(cards: CardSupportAudit[]): string[] {
  if (cards.length === 0) return ['_None._']

  const lines = [
    '| Card | Qty | Role | Candidate | Source | Confidence | Reasons | Gaps |',
    '| --- | ---: | --- | --- | --- | --- | --- | --- |',
  ]

  for (const card of cards) {
    lines.push([
      card.name,
      String(card.quantity),
      card.role,
      card.candidate,
      card.automationSource,
      card.confidence,
      card.reasonCodes.join(', '),
      card.gaps.join('; ') || '-',
    ].map(escapeCell).join(' | ').replace(/^/u, '| ').replace(/$/u, ' |'))
  }

  return lines
}

function renderDeckSection(result: BuiltInDeckSupportResult): string[] {
  const lines = [
    `## ${result.displayName}`,
    '',
    `Deck id: \`${result.id}\`  `,
    `Tier: ${result.tier}  `,
    `Cards: ${result.audit.cardCount}  `,
    `Unique cards: ${result.audit.uniqueCardCount}  `,
    `Blockers: ${getDeckBlockerCount(result.audit)}`,
    '',
  ]

  if (result.importWarnings.length > 0 || result.unresolvedCards.length > 0) {
    lines.push('### Import Notes', '')
    for (const warning of result.importWarnings) lines.push(`- ${warning}`)
    for (const cardName of result.unresolvedCards) lines.push(`- Unresolved: ${cardName}`)
    lines.push('')
  }

  for (const level of ['automated', 'partial', 'manual', 'unsupported'] as const) {
    lines.push(`### ${SUPPORT_LABELS[level]}`, '')
    lines.push(...renderCardRows(result.audit.cards.filter(card => card.supportLevel === level)))
    lines.push('')
  }

  return lines
}

export function renderDeckSupportReport(results: BuiltInDeckSupportResult[], generatedAt: string): string {
  const totalUnique = results.reduce((sum, result) => sum + result.audit.uniqueCardCount, 0)
  const totalAutomated = results.reduce((sum, result) => sum + getAutomatedCount(result.audit), 0)
  const totalRuntimeVerified = results.reduce((sum, result) => sum + getRuntimeVerifiedCount(result.audit), 0)
  const topGaps = getTopCoverageGaps(results)

  const lines = [
    '# Commander Deck Support Report',
    '',
    `Generated: ${generatedAt}`,
    '',
    'This report resolves the built-in decklists through the same Scryfall decklist importer used by the lobby, then audits the resulting card snapshots with `auditImportedDeck`.',
    '',
    '## Pool Summary',
    '',
    `Pool automated coverage: ${totalAutomated}/${totalUnique} unique cards (${pct(totalAutomated, totalUnique)})  `,
    `Pool runtime-verified coverage: ${totalRuntimeVerified}/${totalUnique} unique cards (${pct(totalRuntimeVerified, totalUnique)})`,
    '',
    ...renderSummaryTable(results),
    '',
    '## Top 10 Gaps',
    '',
  ]

  if (topGaps.length === 0) {
    lines.push('_No gaps found._', '')
  } else {
    lines.push('| Rank | Deck | Tier | Card | Level | Role | Candidate | Gaps |')
    lines.push('| ---: | --- | ---: | --- | --- | --- | --- | --- |')
    topGaps.forEach((gap, index) => {
      lines.push([
        String(index + 1),
        gap.deckName,
        String(gap.tier),
        gap.card.name,
        gap.card.supportLevel,
        gap.card.role,
        gap.card.candidate,
        gap.card.gaps.join('; ') || gap.card.reasonCodes.join(', ') || '-',
      ].map(escapeCell).join(' | ').replace(/^/u, '| ').replace(/$/u, ' |'))
    })
    lines.push('')
  }

  for (const result of results) {
    lines.push(...renderDeckSection(result))
  }

  return `${lines.join('\n').trimEnd()}\n`
}
