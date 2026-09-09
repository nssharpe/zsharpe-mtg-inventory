// Resolve Kadyn's sheet against Scryfall to find out how much of it can be
// imported automatically, and where a human has to pick the printing.
import fs from 'node:fs'

const raw = JSON.parse(fs.readFileSync(new URL('./names.json', import.meta.url), 'utf8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const UA = { 'User-Agent': 'ZSharpeMTGInventory/0.1 (nssharpe@gmail.com)', Accept: 'application/json' }

async function api(path) {
  await sleep(110)
  const res = await fetch(`https://api.scryfall.com${path}`, { headers: UA })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json()
}

// Pull the parenthetical hints Kadyn left, then strip them from the name.
function parse(entry) {
  const hints = [...entry.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].toLowerCase())
  let name = entry.replace(/\([^)]*\)/g, '').trim()

  const blob = (hints.join(' ') + ' ' + entry.toLowerCase())
  const leadingFoil = /^foil\s+/i.test(name)
  if (leadingFoil) name = name.replace(/^foil\s+/i, '').trim()

  const foil = leadingFoil || /foil/.test(blob)
  const quantity = /\btwo\b/.test(blob) ? 2 : 1
  // "two and one is foil" / "two one foil" => 2 copies, one of them foil
  const mixedFoil = /two.*(one.*foil|and one is foil)/.test(blob)
  const specialArt = /(borderless|special art|comic art|paper art|name art|marvel|promo|pre.?rele)/.test(blob)

  return { entry, name, hints, foil, quantity, mixedFoil, specialArt }
}

const rows = raw.map(parse)
const out = []

for (let i = 0; i < rows.length; i++) {
  const r = rows[i]
  let card = null
  try {
    card = await api(`/cards/named?fuzzy=${encodeURIComponent(r.name)}`)
  } catch (e) {
    card = null
  }

  if (!card) {
    out.push({ ...r, resolved: false })
    process.stderr.write(`  ${i + 1}/${rows.length} MISS  ${r.name}\n`)
    continue
  }

  // How many distinct printings exist for this card?
  let prints = []
  try {
    const search = await api(
      `/cards/search?q=${encodeURIComponent(`oracleid:${card.oracle_id}`)}&unique=prints&order=released&dir=desc`,
    )
    prints = search?.data ?? []
  } catch (e) {
    prints = [card]
  }

  out.push({
    ...r,
    resolved: true,
    canonical: card.name,
    oracleId: card.oracle_id,
    printCount: prints.length,
    printings: prints.map((p) => ({
      id: p.id,
      set: p.set,
      setName: p.set_name,
      cn: p.collector_number,
      released: p.released_at,
      finishes: p.finishes,
      promo: !!p.promo,
      frame: p.frame_effects ?? [],
      border: p.border_color,
      usd: p.prices?.usd ?? null,
      usdFoil: p.prices?.usd_foil ?? null,
    })),
  })
  process.stderr.write(`  ${i + 1}/${rows.length} ok    ${card.name} (${prints.length} printings)\n`)
}

fs.writeFileSync(new URL('./resolved.json', import.meta.url), JSON.stringify(out, null, 1))

const resolved = out.filter((r) => r.resolved)
const missed = out.filter((r) => !r.resolved)
const single = resolved.filter((r) => r.printCount === 1)
const few = resolved.filter((r) => r.printCount > 1 && r.printCount <= 3)
const many = resolved.filter((r) => r.printCount > 3)

console.log('\n=========== RESOLUTION ===========')
console.log(`total entries          ${out.length}`)
console.log(`resolved by name       ${resolved.length}`)
console.log(`did NOT resolve        ${missed.length}`)
console.log('\n=========== PRINTING AMBIGUITY (of resolved) ===========')
console.log(`exactly 1 printing     ${single.length}   <- import outright`)
console.log(`2-3 printings          ${few.length}   <- import best guess, easy to correct`)
console.log(`4+ printings           ${many.length}   <- needs a human to pick`)
console.log('\n=========== HINTS KADYN LEFT ===========')
console.log(`marked foil            ${out.filter((r) => r.foil).length}`)
console.log(`quantity 2             ${out.filter((r) => r.quantity === 2).length}`)
console.log(`special art/treatment  ${out.filter((r) => r.specialArt).length}`)

if (missed.length) {
  console.log('\n=========== UNRESOLVED ===========')
  for (const m of missed) console.log(`  ${m.entry}`)
}

console.log('\n=========== WORST AMBIGUITY (top 15) ===========')
for (const r of [...many].sort((a, b) => b.printCount - a.printCount).slice(0, 15)) {
  console.log(`  ${String(r.printCount).padStart(3)}  ${r.canonical}`)
}
