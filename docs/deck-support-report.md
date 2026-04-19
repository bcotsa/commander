# Commander Deck Support Report

Generated: 2026-04-19T14:40:00.446Z

This report resolves the built-in decklists through the same Scryfall decklist importer used by the lobby, then audits the resulting card snapshots with `auditImportedDeck`.

## Pool Summary

Pool automated coverage: 65/168 unique cards (38.7%)  
Pool runtime-verified coverage: 5/168 unique cards (3.0%)

| Deck | Tier | Cards | Unique | Automated | Runtime Verified | Partial | Manual | Unsupported | Blockers |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Hazel Squirrels | 1 | 99 | 84 | 31 (36.9%) | 3 (3.6%) | 21 | 28 | 4 | 5 |
| Auntie Ool Blight | 1 | 99 | 84 | 34 (40.5%) | 2 (2.4%) | 21 | 25 | 4 | 5 |

## Top 10 Gaps

| Rank | Deck | Tier | Card | Level | Role | Candidate | Gaps |
| ---: | --- | ---: | --- | --- | --- | --- | --- |
| 1 | Hazel Squirrels | 1 | Promise of Aclazotz // Foul Rebirth | unsupported | engine | bespoke | instant/sorcery has no automated spell definition |
| 2 | Hazel Squirrels | 1 | Rootcast Apprenticeship | unsupported | engine | bespoke | instant/sorcery has no automated spell definition |
| 3 | Hazel Squirrels | 1 | Second Harvest | unsupported | engine | bespoke | instant/sorcery has no automated spell definition |
| 4 | Auntie Ool Blight | 1 | Auntie Ool, Cursewretch | manual | commander | bespoke | no automated card text detected |
| 5 | Auntie Ool Blight | 1 | Aberrant Return | unsupported | removal | generic | instant/sorcery has no automated spell definition |
| 6 | Auntie Ool Blight | 1 | Burning Curiosity | unsupported | removal | bespoke | instant/sorcery has no automated spell definition |
| 7 | Auntie Ool Blight | 1 | Eventide's Shadow | unsupported | draw | generic | instant/sorcery has no automated spell definition |
| 8 | Hazel Squirrels | 1 | Tear Asunder | unsupported | removal | bespoke | instant/sorcery has no automated spell definition |
| 9 | Hazel Squirrels | 1 | Hazel of the Rootbloom | partial | commander | bespoke | review remaining Oracle text for unsupported clauses |
| 10 | Auntie Ool Blight | 1 | Fire Covenant | unsupported | utility | bespoke | instant/sorcery has no automated spell definition |

## Hazel Squirrels

Deck id: `SQUIRREL_TEST_DECK`  
Tier: 1  
Cards: 99  
Unique cards: 84  
Blockers: 5

### Import Notes

- Fuzzy-matched 1 card(s): Promise of Aclazotz // Foul Rebirth

### Automated

| Card | Qty | Role | Candidate | Source | Confidence | Reasons | Gaps |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Bojuka Bog | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Chatterstorm | 1 | engine | generic | generic | parser-match | simple-spell | - |
| Command Tower | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Deadly Dispute | 1 | draw | bespoke | bespoke | runtime-verified | bespoke-handler, custom-spell-resolution, simple-spell | - |
| Decree of Pain | 1 | removal | generic | generic | parser-match | simple-spell, effect-sequence | - |
| Exotic Orchard | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| For the Common Good | 1 | engine | generic | generic | parser-match | simple-spell | - |
| Forest | 9 | mana | generic | generic | runtime-verified | activated-ability, land-mana | - |
| Golgari Rot Farm | 1 | mana | generic | generic | parser-match | activated-ability, land-mana, land-entry-effect | - |
| Grim Backwoods | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Haunted Mire | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Jungle Hollow | 1 | mana | generic | generic | parser-match | activated-ability, triggered-ability, land-mana, land-entry-effect | - |
| Llanowar Wastes | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Maelstrom Pulse | 1 | removal | generic | generic | parser-match | simple-spell | - |
| Oran-Rief, the Vastwood | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Path of Ancestry | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Pest Infestation | 1 | engine | generic | generic | parser-match | simple-spell | - |
| Plumb the Forbidden | 1 | draw | generic | generic | parser-match | simple-spell | - |
| Putrefy | 1 | removal | generic | generic | parser-match | simple-spell | - |
| Saw in Half | 1 | removal | generic | generic | parser-match | simple-spell | - |
| Shamanic Revelation | 1 | draw | generic | generic | parser-match | simple-spell, effect-sequence | - |
| Swamp | 8 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Swarmyard | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Swarmyard Massacre | 1 | removal | generic | generic | parser-match | simple-spell | - |
| Tainted Wood | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Temple of Malady | 1 | mana | generic | generic | parser-match | activated-ability, triggered-ability, land-mana, land-entry-effect | - |
| The Shire | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Tranquil Thicket | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Twilight Mire | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Viridescent Bog | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Woodland Cemetery | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |

### Partial

| Card | Qty | Role | Candidate | Source | Confidence | Reasons | Gaps |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Hazel of the Rootbloom | 1 | commander | bespoke | bespoke | runtime-verified | bespoke-handler, activated-ability, triggered-ability | review remaining Oracle text for unsupported clauses |
| Arcane Signet | 1 | mana | bespoke | bespoke | parser-match | bespoke-handler, activated-ability | review remaining Oracle text for unsupported clauses |
| Beledros Witherbloom | 1 | engine | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Chittering Witch | 1 | removal | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Deep Forest Hermit | 1 | engine | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Evolving Wilds | 1 | mana | manual | generic | parser-match | activated-ability | land has no detected mana ability |
| Garruk, Cursed Huntsman | 1 | removal | generic | generic | parser-match | planeswalker-ability | review remaining Oracle text for unsupported clauses |
| Gilded Goose | 1 | engine | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Hazel's Brewmaster | 1 | engine | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Insatiable Frugivore | 1 | engine | bespoke | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Killer Service | 1 | engine | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Mirkwood Bats | 1 | engine | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Morbid Opportunist | 1 | draw | bespoke | bespoke | parser-match | bespoke-handler, triggered-ability | review remaining Oracle text for unsupported clauses |
| Poison-Tip Archer | 1 | engine | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Prosperous Innkeeper | 1 | engine | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Sol Ring | 1 | mana | bespoke | bespoke | parser-match | bespoke-handler, activated-ability | review remaining Oracle text for unsupported clauses |
| Talisman of Resilience | 1 | mana | manual | generic | parser-match | activated-ability | review remaining Oracle text for unsupported clauses |
| Tendershoot Dryad | 1 | engine | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Terramorphic Expanse | 1 | mana | manual | generic | parser-match | activated-ability | land has no detected mana ability |
| Thornvault Forager | 1 | mana | generic | generic | parser-match | activated-ability | review remaining Oracle text for unsupported clauses |
| Tireless Provisioner | 1 | engine | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |

### Manual

| Card | Qty | Role | Candidate | Source | Confidence | Reasons | Gaps |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Academy Manufactor | 1 | engine | bespoke | core | manual-only | core-combat | no automated card text detected |
| Bastion of Remembrance | 1 | engine | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Beastmaster Ascension | 1 | engine | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Binding the Old Gods | 1 | removal | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Bramble Sovereign | 1 | engine | bespoke | core | manual-only | core-combat | no automated card text detected |
| Camellia, the Seedmiser | 1 | engine | generic | core | manual-only | core-combat | no automated card text detected |
| Chatterfang, Squirrel General | 1 | engine | bespoke | core | manual-only | core-combat | no automated card text detected |
| Chitterspitter | 1 | engine | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Creakwood Liege | 1 | engine | generic | core | manual-only | core-combat | no automated card text detected |
| Gourmand's Talent | 1 | engine | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Honored Dreyleader | 1 | engine | generic | core | manual-only | core-combat | no automated card text detected |
| Idol of Oblivion | 1 | draw | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Maskwood Nexus | 1 | engine | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Mimic Vat | 1 | engine | bespoke | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Moldervine Reclamation | 1 | draw | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Nadier's Nightblade | 1 | engine | generic | core | manual-only | core-combat | no automated card text detected |
| Nexus of Becoming | 1 | draw | bespoke | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Nissa, Ascended Animist | 1 | removal | bespoke | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Nut Collector | 1 | engine | generic | core | manual-only | core-combat | no automated card text detected |
| Ravenous Squirrel | 1 | draw | generic | core | manual-only | core-combat | no automated card text detected |
| Sandstorm Salvager | 1 | engine | generic | core | manual-only | core-combat | no automated card text detected |
| Scurry of Squirrels | 1 | engine | bespoke | core | manual-only | core-combat | no automated card text detected |
| Skullclamp | 1 | draw | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Squirrel Nest | 1 | engine | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Squirrel Sovereign | 1 | combat | manual | core | manual-only | core-combat | no automated card text detected |
| The Odd Acorn Gang | 1 | draw | generic | core | manual-only | core-combat | no automated card text detected |
| Toski, Bearer of Secrets | 1 | draw | generic | core | manual-only | core-combat | no automated card text detected |
| Zulaport Cutthroat | 1 | engine | generic | core | manual-only | core-combat | no automated card text detected |

### Unsupported

| Card | Qty | Role | Candidate | Source | Confidence | Reasons | Gaps |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Promise of Aclazotz // Foul Rebirth | 1 | engine | bespoke | none | manual-only | core-cast-play | instant/sorcery has no automated spell definition |
| Rootcast Apprenticeship | 1 | engine | bespoke | none | manual-only | core-cast-play | instant/sorcery has no automated spell definition |
| Second Harvest | 1 | engine | bespoke | none | manual-only | core-cast-play | instant/sorcery has no automated spell definition |
| Tear Asunder | 1 | removal | bespoke | none | manual-only | core-cast-play | instant/sorcery has no automated spell definition |

## Auntie Ool Blight

Deck id: `BLIGHT_TEST_DECK`  
Tier: 1  
Cards: 99  
Unique cards: 84  
Blockers: 5

### Automated

| Card | Qty | Role | Candidate | Source | Confidence | Reasons | Gaps |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Assassin's Trophy | 1 | removal | generic | generic | parser-match | simple-spell | - |
| Black Sun's Zenith | 1 | removal | bespoke | bespoke | runtime-verified | bespoke-handler, custom-spell-resolution | - |
| Canyon Slough | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Cathartic Pyre | 1 | removal | bespoke | bespoke | parser-match | bespoke-handler, custom-spell-resolution, simple-spell | - |
| Cathartic Reunion | 1 | draw | bespoke | bespoke | parser-match | bespoke-handler, custom-spell-resolution, simple-spell | - |
| Chain Reaction | 1 | utility | generic | generic | parser-match | simple-spell | - |
| Cinder Glade | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Command Tower | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Dragonskull Summit | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Exotic Orchard | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Festering Thicket | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Forest | 6 | mana | generic | generic | runtime-verified | activated-ability, land-mana | - |
| Golgari Rot Farm | 1 | mana | generic | generic | parser-match | activated-ability, land-mana, land-entry-effect | - |
| Gruul Turf | 1 | mana | generic | generic | parser-match | activated-ability, land-mana, land-entry-effect | - |
| Hoarder's Greed | 1 | draw | generic | generic | parser-match | simple-spell | - |
| Ifnir Deadlands | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Incremental Blight | 1 | removal | generic | generic | parser-match | simple-spell | - |
| Infernal Grasp | 1 | removal | generic | generic | parser-match | simple-spell | - |
| Mountain | 4 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Nesting Grounds | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Night's Whisper | 1 | draw | generic | generic | parser-match | simple-spell | - |
| Painful Truths | 1 | draw | bespoke | bespoke | parser-match | bespoke-handler, custom-spell-resolution | - |
| Path of Ancestry | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Persist | 1 | removal | generic | generic | parser-match | simple-spell | - |
| Putrefy | 1 | removal | generic | generic | parser-match | simple-spell | - |
| Rakdos Carnarium | 1 | mana | generic | generic | parser-match | activated-ability, land-mana, land-entry-effect | - |
| Rootbound Crag | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Savage Lands | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Sheltered Thicket | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Smoldering Marsh | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Swamp | 8 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Terminate | 1 | removal | generic | generic | parser-match | simple-spell | - |
| Vernal Fen | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |
| Woodland Cemetery | 1 | mana | generic | generic | parser-match | activated-ability, land-mana | - |

### Partial

| Card | Qty | Role | Candidate | Source | Confidence | Reasons | Gaps |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Arcane Signet | 1 | mana | bespoke | bespoke | parser-match | bespoke-handler, activated-ability | review remaining Oracle text for unsupported clauses |
| Channeler Initiate | 1 | removal | bespoke | bespoke | parser-match | bespoke-handler, activated-ability, triggered-ability | review remaining Oracle text for unsupported clauses |
| Commander's Sphere | 1 | draw | bespoke | bespoke | parser-match | bespoke-handler, activated-ability | review remaining Oracle text for unsupported clauses |
| Contagion Clasp | 1 | removal | bespoke | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Devoted Druid | 1 | removal | bespoke | bespoke | parser-match | bespoke-handler, activated-ability | review remaining Oracle text for unsupported clauses |
| Dread Tiller | 1 | removal | bespoke | bespoke | parser-match | bespoke-handler, triggered-ability | review remaining Oracle text for unsupported clauses |
| Evolution Sage | 1 | engine | bespoke | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Evolving Wilds | 1 | mana | manual | generic | parser-match | activated-ability | land has no detected mana ability |
| Ferrafor, Young Yew | 1 | engine | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Grave Titan | 1 | engine | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Hapatra, Vizier of Poisons | 1 | removal | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Ignoble Hierarch | 1 | engine | bespoke | bespoke | parser-match | bespoke-handler, activated-ability | review remaining Oracle text for unsupported clauses |
| Liliana, Death Wielder | 1 | removal | generic | generic | parser-match | planeswalker-ability | review remaining Oracle text for unsupported clauses |
| Necroskitter | 1 | removal | bespoke | bespoke | parser-match | bespoke-handler, triggered-ability | review remaining Oracle text for unsupported clauses |
| Puppeteer Clique | 1 | removal | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Riveteers Overlook | 1 | mana | manual | generic | parser-match | activated-ability | land has no detected mana ability |
| Skinrender | 1 | removal | generic | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Sol Ring | 1 | mana | bespoke | bespoke | parser-match | bespoke-handler, activated-ability | review remaining Oracle text for unsupported clauses |
| Soul Snuffers | 1 | removal | manual | generic | parser-match | triggered-ability | review remaining Oracle text for unsupported clauses |
| Terramorphic Expanse | 1 | mana | manual | generic | parser-match | activated-ability | land has no detected mana ability |
| Vraska, Betrayal's Sting | 1 | draw | generic | generic | parser-match | planeswalker-ability | review remaining Oracle text for unsupported clauses |

### Manual

| Card | Qty | Role | Candidate | Source | Confidence | Reasons | Gaps |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Auntie Ool, Cursewretch | 1 | commander | bespoke | core | manual-only | core-combat | no automated card text detected |
| Archfiend of Ifnir | 1 | removal | generic | core | manual-only | core-combat | no automated card text detected |
| Binding the Old Gods | 1 | removal | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Blowfly Infestation | 1 | removal | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Carnifex Demon | 1 | removal | manual | core | manual-only | core-combat | no automated card text detected |
| Chimil, the Inner Sun | 1 | engine | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Dusk Urchins | 1 | removal | generic | core | manual-only | core-combat | no automated card text detected |
| Everlasting Torment | 1 | removal | manual | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Flourishing Defenses | 1 | removal | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Glissa Sunslayer | 1 | removal | bespoke | core | manual-only | core-combat | no automated card text detected |
| Grave Venerations | 1 | engine | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Grim Poppet | 1 | removal | generic | core | manual-only | core-combat | no automated card text detected |
| Kulrath Knight | 1 | removal | manual | core | manual-only | core-combat | no automated card text detected |
| Lasting Tarfire | 1 | engine | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Massacre Girl, Known Killer | 1 | removal | generic | core | manual-only | core-combat | no automated card text detected |
| Midnight Banshee | 1 | removal | generic | core | manual-only | core-combat | no automated card text detected |
| Oft-Nabbed Goat | 1 | removal | generic | core | manual-only | core-combat | no automated card text detected |
| Puca's Covenant | 1 | engine | generic | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |
| Sinister Gnarlbark | 1 | removal | generic | core | manual-only | core-combat | no automated card text detected |
| The Reaper, King No More | 1 | removal | generic | core | manual-only | core-combat | no automated card text detected |
| The Scorpion God | 1 | removal | generic | core | manual-only | core-combat | no automated card text detected |
| Tree of Perdition | 1 | combat | generic | core | manual-only | core-combat | no automated card text detected |
| Village Pillagers | 1 | removal | generic | core | manual-only | core-combat | no automated card text detected |
| Wickerbough Elder | 1 | removal | generic | core | manual-only | core-combat | no automated card text detected |
| Wickersmith's Tools | 1 | removal | bespoke | core | manual-only | core-cast-play | permanent can be cast, but no automated card text detected |

### Unsupported

| Card | Qty | Role | Candidate | Source | Confidence | Reasons | Gaps |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Aberrant Return | 1 | removal | generic | none | manual-only | core-cast-play | instant/sorcery has no automated spell definition |
| Burning Curiosity | 1 | removal | bespoke | none | manual-only | core-cast-play | instant/sorcery has no automated spell definition |
| Eventide's Shadow | 1 | draw | generic | none | manual-only | core-cast-play | instant/sorcery has no automated spell definition |
| Fire Covenant | 1 | utility | bespoke | none | manual-only | core-cast-play | instant/sorcery has no automated spell definition |
