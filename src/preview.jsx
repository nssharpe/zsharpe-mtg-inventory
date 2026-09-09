/**
 * Dev-only harness: renders the inventory against fixed sample rows so the
 * layout and legibility can be checked without Firebase. Not part of the
 * production build — `vite build` only has index.html as an input.
 *
 * Run with `npm run dev` and open /preview.html
 */
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import Inventory from './components/Inventory/Inventory.jsx'
import CardDetail from './components/CardDetail.jsx'
import './index.css'

const CARDS = [
  { scryfallId: 'd67be074-cdd4-41d9-ac89-0a0456c4e4b2', name: 'Sheoldred, the Apocalypse', setCode: 'dmu', setName: 'Dominaria United', collectorNumber: '107', colorIdentity: ['B'], typeLine: 'Legendary Creature — Phyrexian Praetor', rarity: 'mythic', cmc: 4, img: 'd/6/d67be074-cdd4-41d9-ac89-0a0456c4e4b2.jpg?1783921327', finish: 'nonfoil', condition: 'NM', quantity: 1, priceUsd: 100.23 },
  { scryfallId: 'dd60b291-0a88-4e8e-bef8-76cdfd6c8183', name: 'Force of Will', setCode: '2xm', setName: 'Double Masters', collectorNumber: '51', colorIdentity: ['U'], typeLine: 'Instant', rarity: 'mythic', cmc: 5, img: 'd/d/dd60b291-0a88-4e8e-bef8-76cdfd6c8183.jpg?1783930199', finish: 'foil', condition: 'LP', quantity: 1, priceUsd: 99.27 },
  { scryfallId: 'a9738cda-adb1-47fb-9f4c-ecd930228c4d', name: 'Ragavan, Nimble Pilferer', setCode: 'mh2', setName: 'Modern Horizons 2', collectorNumber: '138', colorIdentity: ['R'], typeLine: 'Legendary Creature — Monkey Pirate', rarity: 'mythic', cmc: 1, img: 'a/9/a9738cda-adb1-47fb-9f4c-ecd930228c4d.jpg?1783926839', finish: 'nonfoil', condition: 'MP', quantity: 2, priceUsd: 41.27 },
  { scryfallId: '205c4689-8b02-4d40-9274-3c1fcafa8b82', name: 'Cyclonic Rift', setCode: 'rtr', setName: 'Return to Ravnica', collectorNumber: '35', colorIdentity: ['U'], typeLine: 'Instant', rarity: 'rare', cmc: 2, img: '2/0/205c4689-8b02-4d40-9274-3c1fcafa8b82.jpg?1783940370', finish: 'nonfoil', condition: 'NM', quantity: 1, priceUsd: 28.87 },
  { scryfallId: '4a706ecf-3277-40e3-871c-4ba4ead16e20', name: 'Wrenn and Six', setCode: 'mh1', setName: 'Modern Horizons', collectorNumber: '217', colorIdentity: ['G', 'R'], typeLine: 'Legendary Planeswalker — Wrenn', rarity: 'mythic', cmc: 2, img: '4/a/4a706ecf-3277-40e3-871c-4ba4ead16e20.jpg?1783933076', finish: 'nonfoil', condition: 'HP', quantity: 1, priceUsd: 7.58 },
  { scryfallId: '65b7275a-5305-42e6-b5c3-8b88568b4e28', name: 'Thoughtseize', setCode: 'ths', setName: 'Theros', collectorNumber: '107', colorIdentity: ['B'], typeLine: 'Sorcery', rarity: 'rare', cmc: 1, img: '6/5/65b7275a-5305-42e6-b5c3-8b88568b4e28.jpg?1783939770', finish: 'nonfoil', condition: 'NM', quantity: 4, priceUsd: 7.38 },
  { scryfallId: '1920dae4-fb92-4f19-ae4b-eb3276b8dac7', name: 'Counterspell', setCode: 'mh2', setName: 'Modern Horizons 2', collectorNumber: '267', colorIdentity: ['U'], typeLine: 'Instant', rarity: 'uncommon', cmc: 2, img: '1/9/1920dae4-fb92-4f19-ae4b-eb3276b8dac7.jpg?1783926788', finish: 'etched', condition: 'NM', quantity: 3, priceUsd: 3.51 },
  { scryfallId: 'f29ba16f-c8fb-42fe-aabf-87089cb214a7', name: 'Lightning Bolt', setCode: '2x2', setName: 'Double Masters 2022', collectorNumber: '117', colorIdentity: ['R'], typeLine: 'Instant', rarity: 'uncommon', cmc: 1, img: 'f/2/f29ba16f-c8fb-42fe-aabf-87089cb214a7.jpg?1783921885', finish: 'nonfoil', condition: 'LP', quantity: 4, priceUsd: 2.44 },
  { scryfallId: '4cbc6901-6a4a-4d0a-83ea-7eefa3b35021', name: 'Sol Ring', setCode: 'c21', setName: 'Commander 2021', collectorNumber: '263', colorIdentity: [], typeLine: 'Artifact', rarity: 'uncommon', cmc: 1, img: '4/c/4cbc6901-6a4a-4d0a-83ea-7eefa3b35021.jpg?1783927506', finish: 'nonfoil', condition: 'NM', quantity: 2, priceUsd: 1.89 },
  { scryfallId: '581b7327-3215-4a4f-b4ae-d9d4002ba882', name: 'Llanowar Elves', setCode: 'dom', setName: 'Dominaria', collectorNumber: '168', colorIdentity: ['G'], typeLine: 'Creature — Elf Druid', rarity: 'common', cmc: 1, img: '5/8/581b7327-3215-4a4f-b4ae-d9d4002ba882.jpg?1783934977', finish: 'nonfoil', condition: 'DMG', quantity: 8, priceUsd: 0.33 },
  // An unpriced row, to check it renders as an em dash and stays out of totals.
  { scryfallId: 'unpriced-demo', name: 'Unpriced Printing', setCode: 'vma', setName: 'Vintage Masters', collectorNumber: '4', colorIdentity: ['W', 'U'], typeLine: 'Enchantment', rarity: 'rare', cmc: 3, img: '', finish: 'nonfoil', condition: 'NM', quantity: 2, priceUsd: null },
]

const ROWS = CARDS.map((c, i) => ({
  ...c,
  id: `row-${i}`,
  oracleId: `oracle-${i}`,
  language: 'en',
  imageSmall: c.img ? `https://cards.scryfall.io/small/front/${c.img}` : '',
  imageNormal: c.img ? `https://cards.scryfall.io/normal/front/${c.img}` : '',
  addedAt: Date.now() - i * 86400000,
}))

function Preview() {
  const [open, setOpen] = useState(null)
  return (
    <div className="mx-auto max-w-7xl p-4">
      <p className="mb-4 rounded-lg border border-accent/40 bg-surface-800 px-3 py-2 text-xs text-ink-normal">
        Preview harness — sample data, no Firebase. Editing and deleting are inert here.
      </p>
      <Inventory rows={ROWS} onOpen={setOpen} />
      {open && <CardDetail row={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>,
)
