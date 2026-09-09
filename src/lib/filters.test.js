import { describe, it, expect } from 'vitest'
import {
  EMPTY_FILTERS,
  SORTS,
  matchesFilters,
  applyFilters,
  sortRows,
  facetsFor,
  primaryTypeOf,
} from './filters.js'

const rows = [
  {
    id: '1',
    name: 'Lightning Bolt',
    setCode: 'msc',
    setName: 'Mystical Archive',
    colorIdentity: ['R'],
    typeLine: 'Instant',
    rarity: 'uncommon',
    cmc: 1,
    finish: 'nonfoil',
    condition: 'NM',
    quantity: 4,
    priceUsd: 0.72,
    addedAt: 300,
  },
  {
    id: '2',
    name: 'Sol Ring',
    setCode: 'c21',
    setName: 'Commander 2021',
    colorIdentity: [],
    typeLine: 'Artifact',
    rarity: 'uncommon',
    cmc: 1,
    finish: 'foil',
    condition: 'LP',
    quantity: 1,
    priceUsd: 1.89,
    addedAt: 200,
  },
  {
    id: '3',
    name: 'Sheoldred, the Apocalypse',
    setCode: 'dmu',
    setName: 'Dominaria United',
    colorIdentity: ['B'],
    typeLine: 'Legendary Creature — Praetor',
    rarity: 'mythic',
    cmc: 4,
    finish: 'nonfoil',
    condition: 'MP',
    quantity: 1,
    priceUsd: 60,
    addedAt: 100,
  },
  {
    id: '4',
    name: 'Unpriced Oddity',
    setCode: 'vma',
    setName: 'Vintage Masters',
    colorIdentity: ['W', 'U'],
    typeLine: 'Enchantment',
    rarity: 'rare',
    cmc: 3,
    finish: 'nonfoil',
    condition: 'NM',
    quantity: 2,
    priceUsd: null,
    addedAt: 400,
  },
]

describe('matchesFilters', () => {
  it('passes everything when no filter is set', () => {
    expect(rows.every((r) => matchesFilters(r, EMPTY_FILTERS))).toBe(true)
  })

  it('matches a name case-insensitively on a substring', () => {
    expect(matchesFilters(rows[0], { ...EMPTY_FILTERS, search: 'bolt' })).toBe(true)
    expect(matchesFilters(rows[0], { ...EMPTY_FILTERS, search: 'BOLT' })).toBe(true)
    expect(matchesFilters(rows[1], { ...EMPTY_FILTERS, search: 'bolt' })).toBe(false)
  })

  it('also searches the set name', () => {
    expect(matchesFilters(rows[2], { ...EMPTY_FILTERS, search: 'dominaria' })).toBe(true)
  })

  it('filters by colour identity', () => {
    expect(matchesFilters(rows[0], { ...EMPTY_FILTERS, colors: ['R'] })).toBe(true)
    expect(matchesFilters(rows[2], { ...EMPTY_FILTERS, colors: ['R'] })).toBe(false)
  })

  it('treats selected colours as "any of", so multicolour cards match either', () => {
    expect(matchesFilters(rows[3], { ...EMPTY_FILTERS, colors: ['U'] })).toBe(true)
    expect(matchesFilters(rows[3], { ...EMPTY_FILTERS, colors: ['W'] })).toBe(true)
  })

  it('matches colourless cards via the C pseudo-colour', () => {
    expect(matchesFilters(rows[1], { ...EMPTY_FILTERS, colors: ['C'] })).toBe(true)
    expect(matchesFilters(rows[0], { ...EMPTY_FILTERS, colors: ['C'] })).toBe(false)
  })

  it('filters by primary card type', () => {
    expect(matchesFilters(rows[2], { ...EMPTY_FILTERS, types: ['Creature'] })).toBe(true)
    expect(matchesFilters(rows[0], { ...EMPTY_FILTERS, types: ['Creature'] })).toBe(false)
  })

  it('filters by rarity, set, finish and condition', () => {
    expect(matchesFilters(rows[2], { ...EMPTY_FILTERS, rarities: ['mythic'] })).toBe(true)
    expect(matchesFilters(rows[1], { ...EMPTY_FILTERS, sets: ['c21'] })).toBe(true)
    expect(matchesFilters(rows[1], { ...EMPTY_FILTERS, finishes: ['foil'] })).toBe(true)
    expect(matchesFilters(rows[1], { ...EMPTY_FILTERS, conditions: ['NM'] })).toBe(false)
  })

  it('combines filters with AND', () => {
    const f = { ...EMPTY_FILTERS, colors: ['R'], rarities: ['mythic'] }
    expect(matchesFilters(rows[0], f)).toBe(false)
  })
})

describe('applyFilters', () => {
  it('returns only matching rows', () => {
    const out = applyFilters(rows, { ...EMPTY_FILTERS, colors: ['R'] })
    expect(out.map((r) => r.id)).toEqual(['1'])
  })

  it('returns everything unfiltered', () => {
    expect(applyFilters(rows, EMPTY_FILTERS)).toHaveLength(4)
  })

  it('tolerates a null row list', () => {
    expect(applyFilters(null, EMPTY_FILTERS)).toEqual([])
  })
})

describe('sortRows', () => {
  it('sorts by adjusted value descending by default', () => {
    const out = sortRows(rows, 'value-desc')
    expect(out[0].id).toBe('3') // Sheoldred, 60 * 0.70 = 42
  })

  it('sorts unpriced rows last regardless of direction', () => {
    expect(sortRows(rows, 'value-desc').at(-1).id).toBe('4')
    expect(sortRows(rows, 'value-asc').at(-1).id).toBe('4')
  })

  it('sorts by name alphabetically', () => {
    expect(sortRows(rows, 'name-asc').map((r) => r.name)).toEqual([
      'Lightning Bolt',
      'Sheoldred, the Apocalypse',
      'Sol Ring',
      'Unpriced Oddity',
    ])
  })

  it('sorts by mana value', () => {
    expect(sortRows(rows, 'cmc-asc')[0].cmc).toBe(1)
    expect(sortRows(rows, 'cmc-desc')[0].cmc).toBe(4)
  })

  it('sorts by rarity from mythic down', () => {
    expect(sortRows(rows, 'rarity-desc')[0].rarity).toBe('mythic')
  })

  it('sorts by date added, newest first', () => {
    expect(sortRows(rows, 'added-desc')[0].id).toBe('4')
  })

  it('sorts by quantity', () => {
    expect(sortRows(rows, 'qty-desc')[0].quantity).toBe(4)
  })

  it('does not mutate the input array', () => {
    const before = rows.map((r) => r.id)
    sortRows(rows, 'value-desc')
    expect(rows.map((r) => r.id)).toEqual(before)
  })

  it('falls back to the default sort for an unknown key', () => {
    expect(sortRows(rows, 'nonsense')[0].id).toBe('3')
  })

  it('exposes every sort key it supports', () => {
    for (const s of SORTS) {
      expect(() => sortRows(rows, s.key)).not.toThrow()
    }
  })
})

describe('primaryTypeOf', () => {
  it('picks the type after the em dash is stripped', () => {
    expect(primaryTypeOf('Legendary Creature — Praetor')).toBe('Creature')
  })

  it('handles a plain type line', () => {
    expect(primaryTypeOf('Instant')).toBe('Instant')
  })

  it('prefers the most specific type on a multi-type card', () => {
    expect(primaryTypeOf('Artifact Creature — Golem')).toBe('Creature')
  })

  it('returns Other for something unrecognised', () => {
    expect(primaryTypeOf('')).toBe('Other')
    expect(primaryTypeOf(undefined)).toBe('Other')
  })
})

describe('facetsFor', () => {
  it('lists the sets present, sorted by name', () => {
    const f = facetsFor(rows)
    expect(f.sets.map((s) => s.code)).toContain('c21')
    expect(f.sets).toHaveLength(4)
  })

  it('lists the types present', () => {
    expect(facetsFor(rows).types).toContain('Creature')
    expect(facetsFor(rows).types).toContain('Instant')
  })

  it('lists rarities present', () => {
    expect(facetsFor(rows).rarities).toContain('mythic')
  })

  it('handles an empty collection', () => {
    const f = facetsFor([])
    expect(f.sets).toEqual([])
    expect(f.types).toEqual([])
  })
})
