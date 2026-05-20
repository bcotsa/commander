export type SupportConfidence = 'parser-match' | 'runtime-verified' | 'manual-only'

export type CardSupportReasonCode =
  | 'bespoke-handler'
  | 'custom-spell-resolution'
  | 'simple-spell'
  | 'effect-sequence'
  | 'activated-ability'
  | 'triggered-ability'
  | 'planeswalker-ability'
  | 'land-mana'
  | 'land-entry-effect'
  | 'vanilla-permanent'
  | 'core-combat'
  | 'core-cast-play'

export interface SupportVerification {
  reasonCode: CardSupportReasonCode
  cardNames?: string[]
  testFile: string
  testName: string
  notes?: string
}

const VERIFICATIONS: SupportVerification[] = [
  {
    reasonCode: 'bespoke-handler',
    cardNames: ['Hazel of the Rootbloom', "Black Sun's Zenith"],
    testFile: 'src/lib/__tests__/card-rules.test.ts',
    testName: 'exposes supported bespoke card names for deck support tracking',
  },
  {
    reasonCode: 'custom-spell-resolution',
    cardNames: ['Deadly Dispute'],
    testFile: 'src/lib/__tests__/card-rules.test.ts',
    testName: 'identifies bespoke spell-resolution cards',
  },
  {
    reasonCode: 'activated-ability',
    cardNames: ['Hazel of the Rootbloom'],
    testFile: 'src/lib/__tests__/card-rules.test.ts',
    testName: 'detects Hazel token mana ability',
  },
  {
    reasonCode: 'land-mana',
    cardNames: ['Forest'],
    testFile: 'src/lib/__tests__/card-rules.test.ts',
    testName: 'taps lands to pay costs',
  },
  {
    reasonCode: 'simple-spell',
    cardNames: ['Murder'],
    testFile: 'src/lib/__tests__/card-rules.test.ts',
    testName: 'summarizes resolved deck support levels and queues unsupported spells first',
  },
  {
    reasonCode: 'simple-spell',
    testFile: 'src/lib/__tests__/card-rules.test.ts',
    testName: 'parses real oracle texts from Hazel Squirrels deck',
  },
  {
    reasonCode: 'simple-spell',
    testFile: 'src/lib/__tests__/card-rules.test.ts',
    testName: 'parses real oracle texts from Auntie Ool Blight deck',
  },
  {
    reasonCode: 'effect-sequence',
    testFile: 'src/lib/__tests__/card-rules.test.ts',
    testName: 'parses real oracle texts from Hazel Squirrels deck',
  },
  {
    reasonCode: 'simple-spell',
    cardNames: ['Second Harvest'],
    testFile: 'src/lib/__tests__/game-reducer.test.ts',
    testName: 'creates a copy of each token the caster controls',
  },
  {
    reasonCode: 'simple-spell',
    cardNames: ["Eventide's Shadow"],
    testFile: 'src/lib/__tests__/game-reducer.test.ts',
    testName: 'removes all counters, caster draws and loses that much life',
  },
]

function normalizeCardName(name: string): string {
  return name.trim().toLowerCase()
}

export function getSupportVerifications(cardName: string, reasonCodes: CardSupportReasonCode[]): SupportVerification[] {
  const normalized = normalizeCardName(cardName)
  const reasonSet = new Set(reasonCodes)

  return VERIFICATIONS.filter(verification => {
    if (!reasonSet.has(verification.reasonCode)) return false
    if (!verification.cardNames) return true
    return verification.cardNames.some(name => normalizeCardName(name) === normalized)
  })
}

export function getSupportConfidence(cardName: string, reasonCodes: CardSupportReasonCode[], manualOnly: boolean): SupportConfidence {
  if (manualOnly) return 'manual-only'
  return getSupportVerifications(cardName, reasonCodes).length > 0 ? 'runtime-verified' : 'parser-match'
}

export function getAllSupportVerifications(): SupportVerification[] {
  return [...VERIFICATIONS]
}
