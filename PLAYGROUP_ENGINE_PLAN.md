# Playgroup Commander Engine Plan

## Goal

Build a functioning online Commander game that a real playgroup can finish with real decks.

The goal is not full Magic rules completeness. It is a practical hybrid engine:

1. Generic Oracle-text handling for repeatable patterns.
2. Bespoke card support for complex or high-value cards.
3. Manual override as a first-class safety valve.
4. Audit-driven priorities so effort lands on cards that actually affect games.

Target table: 4-player pods. Mental model: "reliable casual table with a very helpful rules assistant and an undo button" — not "complete rules engine."

## Current Direction

The engine has the right broad shape:

- imported deck snapshots
- real card instances and zones
- turn phases
- stack and priority
- simple combat
- token objects
- activated and triggered ability support
- generic parser patterns in `src/lib/card-rules.ts`
- bespoke card registry in `src/lib/card-support/index.ts`
- deck support audit tooling in `src/lib/deck-support-audit.ts`

Next work should focus on coverage, trust, and fallback UX — not more isolated one-off cards.

## Design Principles

### Prefer Generic When The Pattern Repeats

Implement generically when the Oracle pattern appears across many cards or maps cleanly to reusable primitives.

Good generic candidates: simple mana abilities, common removal, draw and life gain, simple token creation, common ETB/dies/attack triggers, simple static buffs, keyword abilities, scry/surveil/mill/proliferate.

Generic support must be pattern-based, deterministic, and covered by tests using real Oracle text.

### Use Bespoke When A Card Is Weird Or Important

Use bespoke handlers when a card is too complex for a parser, or when exact support matters enough that a custom implementation is cheaper than over-generalizing the parser.

Good bespoke candidates: playgroup commanders, cards with replacement effects, unusual copy effects, linked multi-ability cards, dynamic choices not covered by primitives, custom tokens, deck centerpieces, and cards where generic approximation would be actively misleading.

Bespoke support lives in `src/lib/card-support/index.ts`. Drop to reducer-level custom resolution only when a card needs behavior no primitive can yet represent.

The current registry is a single hand-edited array (~25 cards). Fine today, brittle at the bespoke counts implied by Phases 4-6. When the array crosses ~75 entries or a single file exceeds ~500 lines, split per-card files with an index aggregator — don't wait until merges start conflicting.

### Manual Override Is A Core Feature, Not A Failure

The engine will make mistakes and will not support every card. Manual correction must be:

- available during real games
- visible in the log
- undoable
- explicit about what changed
- scoped to the relevant player or card
- safe for network sync

Manual does not replace automation. It lets players recover when automation is missing or wrong.

### Audit Drives Priority

For every deck we care about the audit must answer:

- Which cards are fully automated, partial, manual-only, or unsupported blockers?
- Which unsupported cards share a generic pattern?
- Which deserve bespoke handling?

Phases below use audit percentages as exit criteria. If the audit can't report a number, the phase can't exit.

## Generic Vs Bespoke Decision Framework

For each unsupported card:

**Build generic if** the pattern appears on ≥3 cards in the supported deck pool, maps to an existing primitive, is deterministic, has a reusable choice flow, and helps multiple decks.

Examples: "Destroy target artifact or enchantment." "When this enters, draw a card." "{2}, {T}, Sacrifice this: Draw a card." "Create a 1/1 green Squirrel token."

**Build bespoke if** the card has unusual replacement effects, creates copied objects with special rules, has linked cross-ability choices, is text too broad for safe parsing, is a commander/centerpiece, or generic would be wrong more often than right.

Examples: Hazel of the Rootbloom, Academy Manufactor, Chatterfang, complex planeswalkers, "instead" replacement cards.

**Leave manual if** the card is rare in the pool, not central to gameplay, needs a large new subsystem, is easy to apply by hand, or implementation risk exceeds playability gain.

Examples: obscure alt win-cons, prevention effects, layer-heavy effects, face-down/mutation, deep APNAP ordering.

## Cross-Cutting Subsystems

These are referenced by multiple phases and need owners of their own.

### Target Picker And Choice Flow

This is its own multi-week subsystem, not a one-week side task. It spans state, network sync, and UI. Underestimating it will block Phases 2-4.

Generic removal, triggers, and activated abilities all need one reusable target picker with:

- permanent-type filters (artifact, creature, nonland, etc.)
- controller filters (you, opponent, any)
- zone filters (battlefield, graveyard, hand, exile, library)
- protection/hexproof/shroud stubs (deny target, document gaps as known-wrong)
- "choose N" and "choose one of" modal flows
- optional targets and "you may" handling
- pending-choice state on the stack item (chooser identity, deadline, network-replayable)
- UI affordance for the chooser distinct from the active player

Without this, every new generic pattern grows its own ad-hoc picker. Build it alongside Phase 2; treat the picker's API surface as a deliverable, not an emergent property.

### Replacement Effect Primitive

Full replacement effects are deferred to Phase 8, but commander zone changes (Phase 6) and token-doubling bespoke handlers (Chatterfang/Manufactor) are already replacement-shaped. Introduce a minimal replacement hook before Phase 6 so these three cases share machinery instead of diverging. Full layer support stays out.

**Minimal API shape (sketch, not final):**

```
ReplacementEffect {
  appliesTo: 'zone_change' | 'token_create' | ...   // narrow union, grow as needed
  predicate: (event, gameState) => boolean
  rewrite:   (event, gameState) => Event | Event[] | null   // null = prevent
  source:    GameCardId          // for log + ownership
  oneShot:   boolean             // self-removes after firing
}
```

The reducer fires events through a `runReplacements(event)` step before applying them. Order is source order, not layered. Document the cases this won't handle (multiple replacements interacting, "skip the next" effects) as known gaps.

### Stack Depth And Counterspells

The plan as drafted defers counterspells and stack-object targeting to Phase 8. That's wrong for most playgroups — counterspells are mainstream. Either:

- pull instant-speed response priority + counterspells forward (target: alongside Phase 2), or
- explicitly accept "no counterspells in MVP" and document it in Definition Of Playgroup-Ready.

Pick one before starting Phase 2; do not leave it ambiguous.

### Parser Testing

Every generic pattern lands with Oracle-text snapshot tests: real card text in, expected primitive tree out. Pattern additions without tests do not ship. This is the main defense against parser regressions as coverage grows.

## Manual Override Plan

### Phase M1: Existing Direct Controls (already shipped)

Move cards between zones, tap/untap, adjust life, add/remove counters, draw, inspect graveyard/exile, undo. Keep these — they are the correction foundation.

### Phase M2: Structured Corrections (ship alongside engine Phase 1)

Explicit correction actions, logged as "Manual correction" distinct from normal actions:

- create/delete/clone token
- add/clear mana in pool
- mark and remove damage
- move card with reason
- set commander location
- adjust commander tax
- adjust storm/experience/energy/poison counters

All corrections must be undoable and sync-safe. Ship this early — it is the fallback that makes thin automation tolerable.

**Sync-safety caveat:** "sync-safe" in M2 means the action is serialized through the same reducer/event channel as normal actions. Cross-player **authority** (who is allowed to apply a correction to whose state) lands with Phase 7's host/admin model. Until then, M2 is local-first / single-host-trust; multiplayer M2 will need rework when Phase 7 ships.

### Phase M3: Resolve As Manual (alongside engine Phase 2)

Stack items expose:

- "Resolve automatically" (when supported)
- "Resolve manually" (unsupported or partial)
- "Cancel / counter / remove from stack" (where appropriate)

Manual resolution moves the spell to the right zone, clears the stack item, logs that players applied the effect by hand.

### Phase M4: Admin Mode For Test Games

Host controls every player in test mode: act as any player, edit any zone, add tokens, rewind, force phase, force priority, resolve or remove stack items. Development and playtesting only, not normal multiplayer.

## Built-In Deck Pool

Exit-criteria percentages are measured against a fixed, named pool. Today that pool is:

- `SQUIRREL_TEST_DECK` (Hazel of the Rootbloom — token/aristocrats)
- `BLIGHT_TEST_DECK`

New decks join the pool by being added to `src/lib/test-decks.ts` and the audit runner. Coverage numbers are reported per-deck and as a pool average; pool average is informational, **per-deck pass/fail is the gate** (see "no blocker" rule in Definition Of Playgroup-Ready).

When the playgroup graduates to real decks, those decks join the pool and the same gates apply.

### Deck Tiering

The audit ranks gaps by frequency × deck importance. Deck importance is explicit, not inferred:

- **Tier 1**: decks the playgroup intends to play this month.
- **Tier 2**: decks in the built-in pool not in Tier 1.
- **Tier 3**: speculative / future decks.

A Tier 1 deck with one unsupported commander outranks a Tier 2 deck missing 30 nonbo cards.

## Implementation Phases

Exit criteria are stated as audit percentages over the built-in deck pool **and** as per-deck blocker counts. If the audit does not yet measure a criterion, the phase is not done.

### Phase 1: Audits And Coverage Reporting

Goal: know what matters before building more cards.

This phase is mostly **reporting infrastructure**, not card work. Today `auditImportedDeck` emits support level + reasons/gaps; the items below are net-new and most require new plumbing.

**Scope**

- Resolve built-in decklists through the lobby importer and feed them into `auditImportedDeck`.
- Generate a markdown support report split by: automated, partial, manual, unsupported.
- Tag each entry "generic candidate" vs "bespoke candidate."
- Add a confidence axis: `parser-match` (pattern matched) vs `runtime-verified` (covered by an integration test).
- Add reason codes on generic matches: `simple-removal`, `etb-token`, `mana-rock`, `dies-drain`, etc.
- Track bespoke coverage separately from generic parser coverage.
- Rank top gaps by frequency × deck-importance tier (see Deck Tiering).

**Test-coverage linkage (subsystem)**

The `runtime-verified` tag has no source today. Stand up a small registry that integration tests write to (or that the runner discovers from test names) so a card can be marked verified once a real test exercises it. Without this, the confidence axis is fiction.

**Exit criteria**

- One command produces the report for all built-in decks.
- Report identifies the next 10 cards or patterns to build, partitioned by deck tier.
- Every "automated" card has a confidence tag, and `runtime-verified` actually traces to a passing test.
- Per-deck blocker count (unsupported + unsupported-commander) is reported.

### Phase 2: Generic Spell Coverage

Goal: make common instants and sorceries work without bespoke handlers.

Land alongside: target picker subsystem, manual phase M3.

**Generic patterns**

Destroy target artifact / enchantment / artifact or enchantment / artifact or creature; exile target creature or nonland permanent; return target permanent to hand; target creature ±N/±N; each opponent loses N life; each player loses N life; draw-then-discard and discard-then-draw; simple token creation from spell text; modal "choose one" where each mode maps to a known primitive.

**Bespoke** only where modal or cost text cannot be safely parsed.

**Exit criteria**

- ≥80% of instants and sorceries across the pool are `runtime-verified` automated (pool average).
- No Tier 1 deck has more than 2 unsupported instants/sorceries.
- Any unsupported spell can still be cast via "resolve manually" without breaking the stack.

### Phase 3: Generic Activated Ability System

Goal: replace named activated-ability branches with reusable cost/effect primitives.

**Reducer prerequisite:** `game-reducer.ts` is ~4.7k lines today. The "no reducer changes per ability" exit criterion implies extracting cost/effect dispatch into its own module before adding new abilities, not during. Treat that extraction as the first task in this phase.

**Cost primitives**: tap source, pay mana, pay life, sacrifice source / another creature / an artifact, discard a card, remove a counter, tap N untapped creatures.

**Effect primitives**: add mana, draw, gain life, create tokens, put counters, deal damage, destroy target, search for basic land, explore, scry, surveil.

**Keep bespoke** for Hazel's variable-color mana (until variable costs generalize), Academy Manufactor, Chatterfang, and commanders with custom abilities.

**Manual**: "activate manually" for visible abilities that parse but don't yet automate — pay costs if known, apply effect by hand.

**Exit criteria**

- Mana rocks, dorks, token artifacts, simple sac outlets, and tap abilities all resolve through shared machinery.
- Adding a typical activated ability requires no reducer changes.
- ≥80% of activated abilities across the pool are `runtime-verified` (pool average).
- No Tier 1 deck has an unsupported activated ability on a centerpiece (commander, mana base, primary engine).

### Phase 4: Generic Trigger Coverage

Goal: make battlefield engines feel alive.

**Events**: enters battlefield, creature/token/artifact enters, dies, token dies, creature-you-control dies, one-or-more creatures die, attack, combat damage to player, upkeep, end step, draw card, cast spell.

**Effects**: draw, gain life, drain each opponent, create tokens, put counters, scry/surveil/mill, return from graveyard, copy token.

**Bespoke** for trigger systems with replacement or "instead" text and token doubling (use the replacement primitive from Cross-Cutting).

**Stack controls for triggers**: choose target, skip optional trigger, resolve manually, remove mistaken trigger.

**Exit criteria**

- Aristocrats, ETB value creatures, token engines, and upkeep/end-step engines from playgroup decks play correctly.
- Mistaken triggers can be removed without corrupting game state.
- ≥75% of triggered abilities across the pool are `runtime-verified` (pool average).
- No Tier 1 deck has an unsupported trigger on a centerpiece.

### Phase 5: Static Effects And Combat Keywords

Goal: reduce manual board-state math.

**Static patterns**: creatures/tokens/creature-type-you-control get +N/+N; other-creatures-you-control get +N/+N; "creatures with counters can't attack/block"; opponents can't gain life; damage-as-though-wither.

**Keywords**: flying, reach, vigilance, trample, menace, deathtouch, lifelink, first strike, double strike, infect, wither, haste.

Avoid full layers. Commit to a simplified additive anthem model and log known-wrong stacking cases (e.g. multiple non-commutative anthems) as manual.

**Manual**: power/toughness correction and temporary combat modifiers.

**Exit criteria**

- Combat math is reliable for normal boards.
- Anthem effects are visible and consistently applied for single-anthem cases.

### Phase 6: Commander-Specific Completion

Goal: make Commander feel like Commander. Build on the replacement primitive from Cross-Cutting.

**Rules**: commander tax, cast from command zone, commander damage, zone-change replacement choice, recast count, death/exile/bounce choices.

**Bespoke** for commanders with unusual deckbuilding, alternate casting, or command-zone abilities.

**Manual**: move commander to command zone, adjust tax, adjust commander damage, override location.

**Exit criteria**

- A commander-centric deck plays a full game without commander rules being mostly manual.

### Phase 1.5: Hidden Information (lifted out of Phase 7)

Goal is "real playgroup games remotely," so hand/library hiding is a prerequisite, not late polish. Ship the small, blocking piece early:

- hide opponent hands, libraries, and face-down choices
- server-authoritative reveal (no relying on client to redact)

This is a Phase 1.5 milestone — between coverage reporting and generic spell coverage. Keep the rest of multiplayer trust (authority, reconnect) in Phase 7.

### Phase 7: Multiplayer Trust

Goal: real remote games at table-trust quality.

**Scope**

- reconnect reliability
- explicit host/admin authority
- prevent non-authorized player actions
- tighter action validation
- M2 manual-correction authority model (who can correct whose state)

Manual override in real multiplayer requires host/admin authority, table confirmation, or an explicit permissive casual mode.

**Exit criteria**

- Two players play remotely without hidden-info leaks (validated against Phase 1.5).
- Manual corrections are visible and trusted by the table.
- M2 corrections respect the authority model.

### Phase 8: Larger Rules Subsystems

Once playgroup games are viable, expand: full replacement effects, prevention, copy spells, stack-object targeting and counterspells, APNAP ordering, layers, continuous-effect durations, MDFCs, alternate costs, flash and timing restrictions, richer planeswalker support.

None of these blocks playgroup MVP unless a specific deck depends on them.

## Definition Of Playgroup-Ready

The app is playgroup-ready when:

- every player can import their real deck
- most ordinary cards resolve automatically (target: ≥80% audit coverage, `runtime-verified`, **averaged across the pool**)
- **per-deck rule**: every Tier 1 deck has zero unsupported blockers and a supported (or explicitly bespoke-handled) commander — coverage % alone does not gate; a 95%-covered deck missing its commander is not ready
- complex cards have bespoke support or a clear manual fallback
- games rarely get stuck
- manual corrections are easy, logged, and undoable, with authority model honored in multiplayer
- players can finish a full game remotely (hidden info enforced server-side)
- the explicit position on counterspells (in or out of MVP — see Stack Depth) is honored and documented
