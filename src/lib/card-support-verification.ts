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
  {
    reasonCode: 'activated-ability',
    testFile: 'src/lib/__tests__/card-rules.test.ts',
    testName: 'parses activated abilities from real oracle texts across both decks',
    notes: 'Generic cost/effect primitive parsing (Phase 3)',
  },
  {
    reasonCode: 'activated-ability',
    cardNames: ['Chitterspitter'],
    testFile: 'src/lib/__tests__/game-reducer.test.ts',
    testName: 'creates a token after paying mana and tapping the source (Chitterspitter)',
  },
  {
    reasonCode: 'activated-ability',
    cardNames: ['Gilded Goose'],
    testFile: 'src/lib/__tests__/game-reducer.test.ts',
    testName: 'auto-sacrifices the only matching permanent for a sac cost (Gilded Goose)',
  },
  {
    reasonCode: 'activated-ability',
    cardNames: ['Ravenous Squirrel'],
    testFile: 'src/lib/__tests__/game-reducer.test.ts',
    testName: 'requires an explicit selection for heterogeneous sacrifice costs (Ravenous Squirrel)',
  },
  {
    reasonCode: 'activated-ability',
    cardNames: ['Carnifex Demon'],
    testFile: 'src/lib/__tests__/game-reducer.test.ts',
    testName: 'removes a counter as a cost and spreads counters to each other creature (Carnifex Demon)',
  },
  {
    reasonCode: 'activated-ability',
    cardNames: ['The Scorpion God'],
    testFile: 'src/lib/__tests__/game-reducer.test.ts',
    testName: 'resolves targeted counter placement through the stack (The Scorpion God)',
  },
  {
    reasonCode: 'activated-ability',
    cardNames: ['Contagion Clasp'],
    testFile: 'src/lib/__tests__/game-reducer.test.ts',
    testName: 'opens a proliferate choice from a generic ability (Contagion Clasp)',
  },
  {
    reasonCode: 'activated-ability',
    cardNames: ['Talisman of Resilience'],
    testFile: 'src/lib/__tests__/game-reducer.test.ts',
    testName: 'applies self-damage riders on pain-mana abilities (Talisman of Resilience)',
  },
  {
    reasonCode: 'activated-ability',
    cardNames: ['The Shire'],
    testFile: 'src/lib/__tests__/game-reducer.test.ts',
    testName: 'taps an untapped creature as part of an ability cost (The Shire)',
  },
  {
    reasonCode: 'activated-ability',
    cardNames: ['Ifnir Deadlands'],
    testFile: 'src/lib/__tests__/game-reducer.test.ts',
    testName: 'pays life costs and rejects activation when life is insufficient',
  },
  {
    reasonCode: 'triggered-ability',
    testFile: 'src/lib/__tests__/card-rules.test.ts',
    testName: 'parses triggered abilities from real oracle texts across both decks',
    notes: 'Generic trigger event/effect parsing (Phase 4)',
  },
  {
    reasonCode: 'triggered-ability',
    cardNames: ['Hapatra, Vizier of Poisons'],
    testFile: 'src/lib/__tests__/game-reducer.test.ts',
    testName: 'resolves targeted combat damage triggers and chains follow-up triggers (Hapatra)',
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
