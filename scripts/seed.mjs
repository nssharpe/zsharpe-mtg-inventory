// Turn resolved.json into the seed the app imports.
//
// The seed carries IDS ONLY - no card data, no prices. The import fetches the
// cards at import time through the same code path the add flow uses, so prices
// are fresh and there is no second way to build a row.
import fs from 'node:fs'

const rows = JSON.parse(fs.readFileSync(new URL('./resolved.json', import.meta.url), 'utf8'))
const num = (v) => (v === null || v === undefined ? null : Number(v))
const priceOf = (p, foil) => num(foil ? p.usdFoil : p.usd)

// Secret Lairs, anniversary sets and promo runs keep getting printed, so a
// naive "most recent" lands on one about a third of the time - and they are
// both rare and expensive, which systematically overvalues the collection.
// A card pulled from a pack comes from a regular set.
const ODDBALL = /secret lair|30th anniversary|world championship|judge|art series|gift (pack|bundle)/i
const isOddball = (p) => ODDBALL.test(p.setName)
const isPromo = (p) => p.promo || /promo|prerelease|spotlight series/i.test(p.setName)

/**
 * Most recent printing that supports the finish Kadyn noted, preferring an
 * ordinary set printing. If his note mentioned a promo or prerelease, promos
 * stay in the running. `printings` arrives ordered released desc, so the first
 * match wins. Prefers a priced printing so the row isn't born unpriced.
 */
function pick(printings, foil, allowPromo) {
  const supports = (p) => (foil ? p.finishes.includes('foil') : p.finishes.includes('nonfoil'))
  const priced = (p) => priceOf(p, foil) !== null

  const fits = printings.filter(supports)
  const pool = fits.length ? fits : printings

  // Tiers, best first. Each is tried priced-only, then at all.
  const tiers = allowPromo
    ? [pool.filter((p) => !isOddball(p)), pool]
    : [pool.filter((p) => !isOddball(p) && !isPromo(p)), pool.filter((p) => !isOddball(p)), pool]

  for (const tier of tiers) {
    const hit = tier.find(priced) ?? (tier.length ? tier[0] : null)
    if (hit) return hit
  }
  return pool[0]
}

const seed = []
const skipped = []

for (const r of rows) {
  if (!r.resolved || !r.printings?.length) {
    skipped.push(r.entry)
    continue
  }

  // How wrong can we be? Drives the order Kadyn reviews them in.
  const priced = r.printings.map((p) => priceOf(p, r.foil)).filter((v) => v !== null)
  const spread = priced.length > 1 ? Math.max(...priced) - Math.min(...priced) : 0
  const ambiguous = r.printings.length > 1

  // "two and one is foil" -> one nonfoil copy and one foil copy.
  const variants = r.mixedFoil
    ? [{ foil: false, quantity: 1 }, { foil: true, quantity: 1 }]
    : [{ foil: r.foil, quantity: r.quantity }]

  for (const v of variants) {
    const chosen = pick(r.printings, v.foil, r.specialArt)
    if (!chosen) continue
    const finish = v.foil && chosen.finishes.includes('foil') ? 'foil' : 'nonfoil'

    seed.push({
      scryfallId: chosen.id,
      finish,
      condition: 'NM',
      quantity: v.quantity,
      needsReview: ambiguous,
      // Dollars at stake if this printing guess is wrong.
      reviewPriority: Math.round(spread * v.quantity * 100) / 100,
      // What Kadyn actually typed, so he can recognise the row.
      sourceLabel: r.entry,
    })
  }
}

seed.sort((a, b) => b.reviewPriority - a.reviewPriority)

fs.writeFileSync(
  new URL('./seed.json', import.meta.url),
  JSON.stringify(seed, null, 1),
)

const review = seed.filter((s) => s.needsReview)
console.log(`seed rows            ${seed.length}`)
console.log(`  need review        ${review.length}`)
console.log(`  confirmed outright ${seed.length - review.length}`)
console.log(`  foil rows          ${seed.filter((s) => s.finish === 'foil').length}`)
console.log(`  multi-copy rows    ${seed.filter((s) => s.quantity > 1).length}`)
console.log(`\nskipped (need Kadyn):`)
for (const s of skipped) console.log(`  ${s}`)
console.log(`\ntop of the review queue:`)
for (const s of seed.slice(0, 8)) {
  console.log(`  $${String(s.reviewPriority).padStart(7)}  ${s.sourceLabel}`)
}
