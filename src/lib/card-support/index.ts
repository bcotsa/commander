import type { ActivatedAbilityDefinition, CastChoiceSpec, TriggeredAbilityDefinition } from '../card-rules.ts'
import type { ColorSymbol, GameCard, Player } from '../../types/game-state.ts'

type CardForRules = Pick<GameCard, 'name' | 'typeLine' | 'oracleText' | 'tapped'>

export interface BespokeCardHandler {
  cardNames: string[]
  getCastChoiceSpec?: (card: Pick<GameCard, 'name' | 'manaCost'>, player: Pick<Player, 'life'>) => CastChoiceSpec | null
  getActivatedAbilities?: (card: CardForRules, player: Pick<Player, 'commander'>) => ActivatedAbilityDefinition[]
  getTriggeredAbilities?: (card: Pick<GameCard, 'name' | 'oracleText'>) => TriggeredAbilityDefinition[]
  supportsCustomSpellResolution?: boolean
}

function normalizeCardName(name: string): string {
  return name.trim().toLowerCase()
}

function commanderColorOptions(player: Pick<Player, 'commander'>): ColorSymbol[] {
  return player.commander?.colorIdentity?.length ? player.commander.colorIdentity : ['W', 'U', 'B', 'R', 'G']
}

function simpleManaAbility(color: ColorSymbol, amount = 1): ActivatedAbilityDefinition {
  return {
    id: `mana-${color}-${amount}`,
    label: `Tap for ${color}${amount > 1 ? amount : ''}`,
    kind: 'add_mana',
    color,
    amount,
    requiresTap: true,
  }
}

const BESPOKE_CARD_HANDLERS: BespokeCardHandler[] = [
  {
    cardNames: ["Black Sun's Zenith"],
    supportsCustomSpellResolution: true,
    getCastChoiceSpec: (card) => ({ kind: 'x_value', title: card.name, min: 0, max: 20 }),
  },
  {
    cardNames: ['Painful Truths'],
    supportsCustomSpellResolution: true,
  },
  {
    cardNames: ['Deadly Dispute'],
    supportsCustomSpellResolution: true,
    getCastChoiceSpec: (card) => ({ kind: 'sacrifice_cost', title: card.name, filter: 'artifact_or_creature' }),
  },
  {
    cardNames: ['Cathartic Reunion'],
    supportsCustomSpellResolution: true,
    getCastChoiceSpec: (card) => ({ kind: 'discard_cards', title: card.name, count: 2, min: 2, max: 2 }),
  },
  {
    cardNames: ['Cathartic Pyre'],
    supportsCustomSpellResolution: true,
    getCastChoiceSpec: (card) => ({
      kind: 'modal',
      title: card.name,
      modes: [
        { id: 'damage', label: '3 damage to target creature or planeswalker' },
        { id: 'loot', label: 'Discard up to two cards, then draw that many' },
      ],
    }),
  },
  {
    cardNames: ['Treasure'],
    getActivatedAbilities: (_card, player) =>
      commanderColorOptions(player).map(color => ({
        id: `treasure-${color}`,
        label: `Sac for ${color}`,
        kind: 'add_mana',
        color,
        amount: 1,
        requiresTap: true,
        sacrifice: true,
        genericCost: 0,
      })),
  },
  {
    cardNames: ['Food'],
    getActivatedAbilities: () => [{
      id: 'food-life',
      label: '2, Tap, Sac: Gain 3',
      kind: 'gain_life',
      requiresTap: true,
      sacrifice: true,
      genericCost: 2,
      amount: 3,
    }],
  },
  {
    cardNames: ['Clue'],
    getActivatedAbilities: () => [{
      id: 'clue-draw',
      label: '2, Sac: Draw',
      kind: 'draw_card',
      requiresTap: false,
      sacrifice: true,
      genericCost: 2,
    }],
  },
  {
    cardNames: ['Map'],
    getActivatedAbilities: () => [{
      id: 'map-explore',
      label: '1, Tap, Sac: Explore',
      kind: 'explore_target_creature',
      requiresTap: true,
      sacrifice: true,
      genericCost: 1,
    }],
  },
  {
    cardNames: ['Sol Ring'],
    getActivatedAbilities: () => [simpleManaAbility('C', 2)],
  },
  {
    cardNames: ['Arcane Signet'],
    getActivatedAbilities: (_card, player) => commanderColorOptions(player).map(color => simpleManaAbility(color)),
  },
  {
    cardNames: ["Commander's Sphere"],
    getActivatedAbilities: (_card, player) => [
      ...commanderColorOptions(player).map(color => simpleManaAbility(color)),
      { id: 'draw-sac', label: 'Sacrifice: Draw', kind: 'draw_card', requiresTap: false, sacrifice: true, genericCost: 0 },
    ],
  },
  {
    cardNames: ['Devoted Druid'],
    getActivatedAbilities: () => [
      simpleManaAbility('G'),
      { id: 'untap-minus-one', label: 'Put -1/-1: Untap', kind: 'untap_self_add_minus_one_counter', requiresTap: false },
    ],
  },
  {
    cardNames: ['Ignoble Hierarch'],
    getActivatedAbilities: () => (['B', 'R', 'G'] as const).map(color => simpleManaAbility(color)),
  },
  {
    cardNames: ['Llanowar Elves', 'Elvish Mystic', 'Fyndhorn Elves'],
    getActivatedAbilities: () => [simpleManaAbility('G')],
  },
  {
    cardNames: ['Channeler Initiate'],
    getActivatedAbilities: () =>
      (['W', 'U', 'B', 'R', 'G'] as const).map(color => ({
        id: `remove-minus-one-${color}`,
        label: `Remove -1/-1: Add ${color}`,
        kind: 'remove_minus_one_counter_add_mana',
        color,
        amount: 1,
        requiresTap: true,
      })),
  },
  {
    cardNames: ['Hazel of the Rootbloom'],
    getActivatedAbilities: () => [{
      id: 'hazel-token-mana',
      label: 'Tap tokens: Add mana',
      kind: 'add_mana_from_tapped_tokens',
      requiresTap: true,
      lifeCost: 2,
      genericCost: 0,
    }],
    getTriggeredAbilities: () => [{
      id: 'hazel-copy-token',
      label: 'End step trigger',
      event: 'end_step',
      match: 'your_end_step',
      target: 'token_you_control',
      effect: { kind: 'copy_token', count: 1, doubleIfTargetSubtype: 'squirrel' },
    }],
  },
  {
    cardNames: ['Morbid Opportunist'],
    getTriggeredAbilities: () => [{
      id: 'dies-draw',
      label: 'Dies trigger',
      event: 'creature_dies',
      match: 'any_creature',
      effect: { kind: 'draw_cards', amount: 1 },
      target: 'none',
    }],
  },
  {
    cardNames: ['Dread Tiller'],
    getTriggeredAbilities: () => [{
      id: 'etb-minus-one-target',
      label: 'ETB trigger',
      event: 'enters_battlefield',
      match: 'self',
      target: 'battlefield_creature',
      effect: { kind: 'put_minus_one_counter_target_creature', amount: 1 },
    }],
  },
  {
    cardNames: ['Necroskitter'],
    getTriggeredAbilities: () => [{
      id: 'opponent-counter-dies-reanimate',
      label: 'Dies trigger',
      event: 'creature_dies',
      match: 'opponent_creature_with_minus_one_counter_dies',
      target: 'opponent_graveyard_creature',
      effect: { kind: 'return_graveyard_creature_to_battlefield', target: 'opponent_graveyard_creature' },
    }],
  },
]

export function getBespokeCardHandlers(cardName: string): BespokeCardHandler[] {
  const normalized = normalizeCardName(cardName)
  return BESPOKE_CARD_HANDLERS.filter(handler =>
    handler.cardNames.some(name => normalizeCardName(name) === normalized)
  )
}

export function getBespokeCastChoiceSpec(card: Pick<GameCard, 'name' | 'manaCost'>, player: Pick<Player, 'life'>): CastChoiceSpec | null {
  for (const handler of getBespokeCardHandlers(card.name)) {
    const spec = handler.getCastChoiceSpec?.(card, player)
    if (spec) return spec
  }
  return null
}

export function getBespokeActivatedAbilities(card: CardForRules, player: Pick<Player, 'commander'>): ActivatedAbilityDefinition[] {
  return getBespokeCardHandlers(card.name).flatMap(handler => handler.getActivatedAbilities?.(card, player) ?? [])
}

export function getBespokeTriggeredAbilities(card: Pick<GameCard, 'name' | 'oracleText'>): TriggeredAbilityDefinition[] {
  return getBespokeCardHandlers(card.name).flatMap(handler => handler.getTriggeredAbilities?.(card) ?? [])
}

export function hasBespokeSpellResolution(cardName: string): boolean {
  return getBespokeCardHandlers(cardName).some(handler => handler.supportsCustomSpellResolution)
}

export function getSupportedBespokeCardNames(): string[] {
  return [...new Set(BESPOKE_CARD_HANDLERS.flatMap(handler => handler.cardNames))].sort((a, b) => a.localeCompare(b))
}
