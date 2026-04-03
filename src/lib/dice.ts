export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'coin'

export interface DiceRoll {
  die: DieType
  result: number | 'heads' | 'tails'
  timestamp: number
}

export function rollDie(die: DieType): DiceRoll {
  if (die === 'coin') {
    return { die, result: Math.random() < 0.5 ? 'heads' : 'tails', timestamp: Date.now() }
  }
  const sides = parseInt(die.slice(1))
  return { die, result: Math.floor(Math.random() * sides) + 1, timestamp: Date.now() }
}

export function dieLabel(die: DieType): string {
  return die === 'coin' ? 'Coin' : die.toUpperCase()
}
