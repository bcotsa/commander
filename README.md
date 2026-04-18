# Commander

A prototype web app for playing a simplified game of Magic: The Gathering Commander online.

The project started as a Commander tracker and is being expanded into a playable game engine with real zones, card movement, turn flow, mana, combat, and a lightweight stack/priority system.

## Current Features

- Import Commander decks from pasted decklists
- Auto-load a 2-player local test match from built-in test decks
- Build real zones at game start:
  - library
  - hand
  - lands
  - battlefield
  - graveyard
  - exile
  - command zone
- Draw opening hands automatically
- Visible card images from Scryfall data
- Turn structure with:
  - untap
  - upkeep
  - draw
  - main 1
  - combat
  - main 2
  - end
- Auto-advance through untap, upkeep, and draw
- Play lands
- Tap lands and battlefield mana sources for mana
- Auto-pay mana when casting
- Cast permanents and a subset of instants/sorceries
- Shared stack panel
- Priority passing around the stack
- Simple combat:
  - attackers
  - blockers
  - commander damage
  - lethal combat damage
- Activated mana abilities for a small set of rocks/dorks
- Release/version badge shown in the UI

## Current Limitations

This is still an early engine, not full Magic rules support.

Known limitations include:

- Only a subset of card text is implemented
- Most unsupported spells or abilities still need manual handling
- Triggered abilities are not generally implemented
- Replacement effects are not implemented
- Layer/dependency rules are not implemented
- Counterspells and stack interaction are still minimal
- Hidden information is not enforced yet
- Hand privacy is not enforced yet
- Priority/response behavior is simplified

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- Supabase

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

## Running a Fast Local Test Match

The lobby includes a visible test-flow button that:

- loads two built-in decklists
- creates a fake second player
- imports both decks
- auto-starts the game

This is the fastest way to test game flow without opening multiple browsers or importing decks manually every time.

## Deck Import

The most reliable import path right now is pasted decklist text.

Recommended format:

```text
Commander
1 Your Commander

Deck
1 Sol Ring
1 Command Tower
1 Arcane Signet
```

The importer will also try to be forgiving:

- it can skip unresolved cards
- it can report unresolved names
- it may infer a commander if one is not explicitly labeled

## Gameplay Model

The app currently uses a deterministic shared state model with:

- imported card snapshots
- concrete game-card instances
- reducer-driven state transitions
- synced multiplayer state

Important engine files:

- [src/lib/game-reducer.ts](/Users/bcotsa/projects/Commander/src/lib/game-reducer.ts)
- [src/lib/card-rules.ts](/Users/bcotsa/projects/Commander/src/lib/card-rules.ts)
- [src/lib/card-support/index.ts](/Users/bcotsa/projects/Commander/src/lib/card-support/index.ts)
- [src/types/game-state.ts](/Users/bcotsa/projects/Commander/src/types/game-state.ts)

## Bespoke Card Support

The engine uses a hybrid card-support model:

- generic Oracle-text patterns live in [src/lib/card-rules.ts](/Users/bcotsa/projects/Commander/src/lib/card-rules.ts)
- named-card support lives in [src/lib/card-support/index.ts](/Users/bcotsa/projects/Commander/src/lib/card-support/index.ts)
- deeper bespoke spell resolution still runs through [src/lib/game-reducer.ts](/Users/bcotsa/projects/Commander/src/lib/game-reducer.ts), gated by the card-support registry

Use the bespoke registry for playgroup cards that need exact handling instead of adding new scattered `card.name === ...` checks.

## Release Version

The app shows a semantic version badge in the UI from:

- [src/lib/release.ts](/Users/bcotsa/projects/Commander/src/lib/release.ts)

Patch version should be incremented for each normal PR/push.

## Recommended Next Areas

Likely next phases include:

- broader activated ability support
- triggered abilities
- better spell/stack coverage
- more accurate response windows
- improved multiplayer rules enforcement
