import type { GameCard, Player, StackItem, TargetChoiceType } from '@/types/game-state'

export type LegalTargetOption =
  | { kind: 'card'; player: Player; card: GameCard }
  | { kind: 'player'; player: Player }
  | { kind: 'stack'; stackItem: StackItem }

function isCreatureCard(card: Pick<GameCard, 'typeLine' | 'power' | 'toughness'>): boolean {
  return card.typeLine.toLowerCase().includes('creature') && card.power !== null && card.toughness !== null
}

function isPlaneswalkerCard(card: Pick<GameCard, 'typeLine' | 'loyalty'>): boolean {
  return card.typeLine.toLowerCase().includes('planeswalker') && card.loyalty !== null
}

function isPermanentCard(card: Pick<GameCard, 'typeLine'>): boolean {
  const typeLine = card.typeLine.toLowerCase()
  return !typeLine.includes('instant') && !typeLine.includes('sorcery')
}

function isLandCard(card: Pick<GameCard, 'typeLine'>): boolean {
  return card.typeLine.toLowerCase().includes('land')
}

function graveyardTargetMatches(targetType: TargetChoiceType, chooserId: string, ownerId: string): boolean {
  if (targetType === 'own_graveyard_creature') return ownerId === chooserId
  if (targetType === 'opponent_graveyard_creature') return ownerId !== chooserId
  return targetType === 'any_graveyard_creature'
}

export function getLegalTargetOptions(
  players: Player[],
  targetType: TargetChoiceType,
  chooserId: string,
  stack: StackItem[] = [],
  excludeStackItemId?: string
): LegalTargetOption[] {
  if (targetType === 'stack_spell') {
    return stack
      .filter(item => item.kind === 'spell' || item.kind === 'permanent' || item.kind === 'commander')
      .filter(item => item.id !== excludeStackItemId)
      .map(stackItem => ({ kind: 'stack' as const, stackItem }))
  }

  if (targetType === 'player') {
    return players
      .filter(player => !player.isEliminated)
      .map(player => ({ kind: 'player', player }))
  }

  if (targetType === 'creature_or_player') {
    return [
      ...players
        .filter(player => !player.isEliminated)
        .map(player => ({ kind: 'player' as const, player })),
      ...players.flatMap(player =>
        player.zones.battlefield
          .filter(card => isCreatureCard(card) || isPlaneswalkerCard(card))
          .map(card => ({ kind: 'card' as const, player, card }))
      ),
    ]
  }

  if (targetType === 'battlefield_creature') {
    return players.flatMap(player =>
      player.zones.battlefield
        .filter(isCreatureCard)
        .map(card => ({ kind: 'card' as const, player, card }))
    )
  }

  if (targetType === 'battlefield_creature_or_planeswalker') {
    return players.flatMap(player =>
      player.zones.battlefield
        .filter(card => isCreatureCard(card) || isPlaneswalkerCard(card))
        .map(card => ({ kind: 'card' as const, player, card }))
    )
  }

  if (targetType === 'battlefield_nonland_permanent') {
    return players.flatMap(player =>
      player.zones.battlefield
        .filter(card => isPermanentCard(card) && !isLandCard(card))
        .map(card => ({ kind: 'card' as const, player, card }))
    )
  }

  if (targetType === 'battlefield_permanent') {
    return players.flatMap(player =>
      [...player.zones.battlefield, ...player.zones.lands]
        .filter(card => isPermanentCard(card) || isLandCard(card))
        .map(card => ({ kind: 'card' as const, player, card }))
    )
  }

  if (targetType === 'token_you_control') {
    const chooser = players.find(player => player.id === chooserId)
    return chooser
      ? chooser.zones.battlefield
        .filter(card => card.isToken)
        .map(card => ({ kind: 'card' as const, player: chooser, card }))
      : []
  }

  return players.flatMap(player => {
    if (!graveyardTargetMatches(targetType, chooserId, player.id)) return []
    return player.zones.graveyard
      .filter(isCreatureCard)
      .map(card => ({ kind: 'card' as const, player, card }))
  })
}

export function hasLegalTarget(players: Player[], targetType: TargetChoiceType, chooserId: string, stack: StackItem[] = [], excludeStackItemId?: string): boolean {
  return getLegalTargetOptions(players, targetType, chooserId, stack, excludeStackItemId).length > 0
}

export function isLegalTarget(
  players: Player[],
  targetType: TargetChoiceType,
  chooserId: string,
  targetCardId?: string,
  targetPlayerId?: string,
  targetStackItemId?: string,
  stack: StackItem[] = [],
  excludeStackItemId?: string
): boolean {
  return getLegalTargetOptions(players, targetType, chooserId, stack, excludeStackItemId).some(option => {
    if (option.kind === 'player') return option.player.id === targetPlayerId
    if (option.kind === 'stack') return option.stackItem.id === targetStackItemId
    return option.card.instanceId === targetCardId
  })
}

export function targetChoiceLabel(targetType: TargetChoiceType): string {
  switch (targetType) {
    case 'battlefield_creature':
      return 'Choose a creature target'
    case 'battlefield_creature_or_planeswalker':
      return 'Choose a creature or planeswalker target'
    case 'battlefield_nonland_permanent':
      return 'Choose a nonland permanent target'
    case 'battlefield_permanent':
      return 'Choose a permanent target'
    case 'creature_or_player':
      return 'Choose a creature, planeswalker, or player target'
    case 'player':
      return 'Choose a player target'
    case 'stack_spell':
      return 'Choose a spell on the stack'
    case 'token_you_control':
      return 'Choose a token you control'
    case 'own_graveyard_creature':
      return 'Choose a creature card from your graveyard'
    case 'opponent_graveyard_creature':
      return "Choose a creature card from an opponent's graveyard"
    case 'any_graveyard_creature':
      return 'Choose a creature card from a graveyard'
  }
}
