# Commander MVP Roadmap

This roadmap focuses on the shortest path from the current prototype to a first genuinely playable Commander MVP.

It is intentionally narrower than “full Magic rules support.” The goal is to make a real game playable end to end with a constrained but coherent rules subset.

## Current Baseline

The project already has:

- deck import from pasted decklists
- a built-in 2-player test flow
- real game zones
- opening hands and shuffled libraries
- turn phases
- mana pool and auto-pay
- shared stack panel
- simple priority passing
- simple combat
- a small activated-ability system

That means the MVP is no longer blocked on app shell or multiplayer basics. The remaining work is mostly rules coverage, interaction flow, and gameplay completeness.

## MVP Definition

A “Commander MVP” should allow two players to:

- load decks
- start a game reliably
- take turns
- cast a meaningful portion of cards from normal Commander decks
- respond with instants and activated abilities
- attack and block
- lose and win under consistent rules

It does not need:

- full Oracle-text coverage
- every edge-case rules interaction
- complete hidden-information enforcement
- tournament-level correctness

## Phase 1: Stabilize The Current Core

Goal: make the current engine predictable enough that testing stops feeling brittle.

### Must Have

- tighten stack and priority behavior
- ensure pass/resolve flow works consistently in both real multiplayer and test mode
- verify turn progression after stack resolution
- confirm mana pool clearing is correct across phase and turn changes
- remove UI ambiguities around who can act
- make sure undo is trustworthy for current supported actions

### Exit Criteria

- a full 2-player test game can proceed for multiple turns without getting stuck
- host-controlled test mode behaves differently from normal multiplayer in a deliberate, explicit way
- common “can’t act” and “can’t pass” failure cases are gone

## Phase 2: Expand Core Card Coverage

Goal: support a much larger slice of normal Commander gameplay from typical decks.

### Must Have

- more activated abilities
  - mana rocks
  - mana dorks
  - sacrifice abilities
  - simple tap abilities
- broader instant/sorcery support
  - draw
  - removal
  - damage
  - recursion
  - token creation where simple
- better permanent support
  - ETB value creatures
  - common static modifiers where easy

### Recommended Approach

- keep using explicit pattern-based support
- prioritize cards from the built-in test decks first
- then support the most common Commander staples

### Exit Criteria

- the built-in test decks are mostly playable without frequent manual intervention
- common staple cards stop falling into the “unsupported” bucket

## Phase 3: Triggered Abilities

Goal: make the battlefield feel like Magic rather than a mostly manual simulator.

### Must Have

- ETB triggers
- dies triggers
- combat-damage triggers
- upkeep triggers
- triggered abilities going onto the stack

### Scope Guidance

Do not aim for all triggers at once.

Start with:

- “when this enters”
- “when this dies”
- “at the beginning of upkeep”
- “whenever a creature dies”
- “whenever you draw”

### Exit Criteria

- the stack can hold both spells and triggered abilities
- common value creatures and engines from test decks work automatically

## Phase 4: Better Battlefield Interaction

Goal: make board states easier to read and interact with as complexity grows.

### Must Have

- clearer tapped/untapped readability
- counters displayed on cards
- token representation
- better stack item target summaries
- cleaner priority indicators
- easier graveyard/exile inspection

### Nice To Have

- battlefield grouping by card type
- improved selected-card previews
- lightweight action history tied to cards

### Exit Criteria

- midgame boards are readable without guessing
- tokens and counters are not “mental-state only”

## Phase 5: Commander-Specific Rules Completion

Goal: cover the Commander-specific rules that make the format feel complete.

### Must Have

- commander tax
- commander recast flow from command zone
- commander death/bounce/exile replacement choice
- commander damage win condition fully surfaced in UI
- color identity validation improvements at import/setup time

### Exit Criteria

- a commander-centric deck can actually play like a commander deck
- commanders feel like special game objects, not just normal permanents

## Phase 6: Hidden Information And Real Multiplayer Hardening

Goal: move from open testing sandbox toward a more real online game.

### Must Have

- hand privacy
- library privacy
- opponent-only visible zones enforced correctly
- cleaner server/host authority around sensitive state
- better reconnect behavior

### Important Note

This is probably later than it sounds. Right now open information is helping iteration. It becomes worth enforcing once the gameplay loop itself is stable enough to preserve.

### Exit Criteria

- two real players can play without seeing each other’s hands
- reconnects do not corrupt or expose hidden state

## Phase 7: Rules Depth Beyond MVP

This is where the project starts moving from MVP toward a more complete engine.

Examples:

- replacement effects
- prevention effects
- layers
- copy effects
- flash and more nuanced response timing
- counterspells and stack-object targeting
- APNAP edge cases
- more complete combat keywords
- planeswalkers

This phase is important, but it should not block a useful MVP.

## Recommended Immediate Priorities

If optimizing for fastest progress toward MVP, the next work should be:

1. Stabilize current stack/priority/test-mode behavior
2. Expand activated abilities for real battlefield cards
3. Expand spell support for the built-in test decks
4. Add triggered abilities for the most common cards in those decks

That sequence gives the biggest increase in “real playability” without requiring a full general-purpose rules engine first.

## Suggested MVP Checklist

- test flow starts a reliable 2-player game
- both players can cast spells and use mana sources
- both players can respond on the stack
- combat works consistently
- commander casting and commander damage are reliable
- most cards in the built-in decks either work or fail with a clear manual fallback
- no common dead-end UI states
- no frequent desyncs in host/client flow

## Practical Definition Of “Good Enough”

The MVP is probably ready when:

- you can play a full 2-player game with the built-in test decks
- manual intervention is occasional, not constant
- losses feel like card/rules decisions, not engine bugs
- the game no longer gets stuck in normal playtesting sessions

