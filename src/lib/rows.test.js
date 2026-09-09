import { describe, it, expect } from 'vitest'
import { rowId, rowFromCard, availableFinishes, chunk } from './rows.js'

const bolt = {
  id: '7673784e-db4b-43a1-8d55-1bb9fc1e284f',
  oracle_id: '4457ed35-7c10-48c8-9776-456485fdf070',
  name: 'Lightning Bolt',
  set: 'msc',
  set_name: 'Mystical Archive',
  collector_number: '806',
  colors: ['R'],
  color_identity: ['R'],
  type_line: 'Instant',
  rarity: 'uncommon',
  cmc: 1,
  finishes: ['nonfoil', 'foil'],
  image_uris: {
    small: 'https://img/small.jpg',
    normal: 'https://img/normal.jpg',
  },
  prices: { usd: '0.72', usd_foil: '4.37', usd_etched: null },
}

describe('rowId', () => {
  it('is stable for the same printing, finish, condition and language', () => {
    const a = rowId({ scryfallId: 'abc', finish: 'foil', condition: 'LP', language: 'en' })
    const b = rowId({ scryfallId: 'abc', finish: 'foil', condition: 'LP', language: 'en' })
    expect(a).toBe(b)
  })

  it('separates finishes so a foil is never merged into a nonfoil', () => {
    const nonfoil = rowId({ scryfallId: 'abc', finish: 'nonfoil', condition: 'NM' })
    const foil = rowId({ scryfallId: 'abc', finish: 'foil', condition: 'NM' })
    expect(nonfoil).not.toBe(foil)
  })

  it('separates conditions', () => {
    const nm = rowId({ scryfallId: 'abc', finish: 'nonfoil', condition: 'NM' })
    const lp = rowId({ scryfallId: 'abc', finish: 'nonfoil', condition: 'LP' })
    expect(nm).not.toBe(lp)
  })

  it('separates printings of the same card', () => {
    const one = rowId({ scryfallId: 'abc', finish: 'nonfoil', condition: 'NM' })
    const two = rowId({ scryfallId: 'xyz', finish: 'nonfoil', condition: 'NM' })
    expect(one).not.toBe(two)
  })

  it('defaults language to en so older rows keep the same id', () => {
    const withLang = rowId({ scryfallId: 'abc', finish: 'foil', condition: 'NM', language: 'en' })
    const without = rowId({ scryfallId: 'abc', finish: 'foil', condition: 'NM' })
    expect(withLang).toBe(without)
  })

  it('produces an id safe to use as a Firestore document id', () => {
    const id = rowId({ scryfallId: bolt.id, finish: 'nonfoil', condition: 'NM' })
    expect(id).not.toContain('/')
    expect(id).not.toContain('.')
    expect(id.length).toBeLessThanOrEqual(1500)
    expect(id.length).toBeGreaterThan(0)
  })
})

describe('rowFromCard', () => {
  it('denormalizes the fields the inventory view filters and sorts on', () => {
    const row = rowFromCard(bolt, { finish: 'nonfoil', condition: 'NM', quantity: 2 })
    expect(row).toMatchObject({
      scryfallId: bolt.id,
      oracleId: bolt.oracle_id,
      name: 'Lightning Bolt',
      setCode: 'msc',
      setName: 'Mystical Archive',
      collectorNumber: '806',
      colorIdentity: ['R'],
      typeLine: 'Instant',
      rarity: 'uncommon',
      cmc: 1,
      finish: 'nonfoil',
      condition: 'NM',
      quantity: 2,
      language: 'en',
    })
  })

  it('captures the price for the chosen finish, not the default one', () => {
    const foil = rowFromCard(bolt, { finish: 'foil', condition: 'NM', quantity: 1 })
    expect(foil.priceUsd).toBe(4.37)
    const normal = rowFromCard(bolt, { finish: 'nonfoil', condition: 'NM', quantity: 1 })
    expect(normal.priceUsd).toBe(0.72)
  })

  it('stores a null price rather than zero when the finish is unpriced', () => {
    const etched = rowFromCard(bolt, { finish: 'etched', condition: 'NM', quantity: 1 })
    expect(etched.priceUsd).toBeNull()
  })

  it('copies both image sizes', () => {
    const row = rowFromCard(bolt, { finish: 'nonfoil', condition: 'NM', quantity: 1 })
    expect(row.imageSmall).toBe('https://img/small.jpg')
    expect(row.imageNormal).toBe('https://img/normal.jpg')
  })

  it('falls back to the front face image on a double-faced card', () => {
    const dfc = {
      ...bolt,
      image_uris: undefined,
      card_faces: [
        { image_uris: { small: 'https://img/front-small.jpg', normal: 'https://img/front.jpg' } },
        { image_uris: { small: 'https://img/back-small.jpg', normal: 'https://img/back.jpg' } },
      ],
    }
    const row = rowFromCard(dfc, { finish: 'nonfoil', condition: 'NM', quantity: 1 })
    expect(row.imageNormal).toBe('https://img/front.jpg')
  })

  it('uses color identity for a land with no colors', () => {
    const land = { ...bolt, colors: [], color_identity: ['G'], type_line: 'Land' }
    const row = rowFromCard(land, { finish: 'nonfoil', condition: 'NM', quantity: 1 })
    expect(row.colorIdentity).toEqual(['G'])
  })

  it('clamps quantity to at least one', () => {
    const row = rowFromCard(bolt, { finish: 'nonfoil', condition: 'NM', quantity: 0 })
    expect(row.quantity).toBe(1)
  })

  it('never writes undefined, which Firestore rejects', () => {
    const sparse = { id: 'x', name: 'Nameless', finishes: ['nonfoil'] }
    const row = rowFromCard(sparse, { finish: 'nonfoil', condition: 'NM', quantity: 1 })
    for (const [key, value] of Object.entries(row)) {
      expect(value, `${key} must not be undefined`).not.toBeUndefined()
    }
  })
})

describe('availableFinishes', () => {
  it('lists only the finishes the printing actually comes in', () => {
    expect(availableFinishes(bolt).map((f) => f.code)).toEqual(['nonfoil', 'foil'])
  })

  it('falls back to nonfoil when the card omits finishes', () => {
    expect(availableFinishes({}).map((f) => f.code)).toEqual(['nonfoil'])
  })

  it('ignores finishes it does not know how to price', () => {
    const odd = { finishes: ['nonfoil', 'glossy'] }
    expect(availableFinishes(odd).map((f) => f.code)).toEqual(['nonfoil'])
  })
})

describe('chunk', () => {
  it('splits into groups of the requested size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('returns one group when the list fits', () => {
    expect(chunk([1, 2], 75)).toEqual([[1, 2]])
  })

  it('returns nothing for an empty list', () => {
    expect(chunk([], 75)).toEqual([])
  })

  it('respects the Scryfall 75-identifier limit', () => {
    const ids = Array.from({ length: 160 }, (_, i) => i)
    const groups = chunk(ids, 75)
    expect(groups).toHaveLength(3)
    expect(groups.every((g) => g.length <= 75)).toBe(true)
    expect(groups.flat()).toHaveLength(160)
  })
})
