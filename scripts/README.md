# Seed generation

One-time scripts that turned Kadyn's Google Sheet into
`src/data/kadyn-sheet-seed.json`. Kept for provenance and in case the sheet is
revised; not part of the app build.

```bash
node scripts/resolve.mjs   # names.json -> resolved.json (Scryfall fuzzy match)
node scripts/seed.mjs      # resolved.json -> seed.json
```

The sheet held card names only — no set, no condition. `resolve.mjs` fuzzy-matches
each name against Scryfall (224 of 229 matched despite typos like "silkgaurd" and
"whatery grave"). `seed.mjs` then picks a printing and records how many dollars
ride on that guess being wrong, which is what orders the in-app review queue.

**Why the printing guess avoids promos:** a naive "most recent printing" landed on
a Secret Lair or promo run for 72 of 226 rows, because those keep being printed
and are both scarce and expensive — it inflated the collection by roughly $300.
`pick()` now prefers the most recent *ordinary set* printing, and only considers
promos when Kadyn's own note said so ("2025 pre release foil"). That cut promo
picks to 6, all of them ones he flagged.

Everything imports as Near Mint, since the sheet had no grades.
