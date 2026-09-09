import { describe, it, expect } from 'vitest'
import {
  CONDITIONS,
  CONDITION_MULTIPLIER,
  BUYLIST,
  FINISH_PRICE_KEY,
  priceForFinish,
  lineMarketValue,
  lineAdjustedValue,
  buylistCash,
  buylistCredit,
  collectionTotals,
  formatUsd,
} from './pricing.js'

const prices = {
  usd: '10.00',
  usd_foil: '25.50',
  usd_etched: null,
  eur: '9.00',
  tix: '0.5',
}

describe('priceForFinish', () => {
  it('reads usd for nonfoil', () => {
    expect(priceForFinish(prices, 'nonfoil')).toBe(10)
  })

  it('reads usd_foil for foil', () => {
    expect(priceForFinish(prices, 'foil')).toBe(25.5)
  })

  it('returns null when the finish has no price', () => {
    expect(priceForFinish(prices, 'etched')).toBeNull()
  })

  it('returns null for a missing prices object', () => {
    expect(priceForFinish(null, 'nonfoil')).toBeNull()
    expect(priceForFinish(undefined, 'nonfoil')).toBeNull()
  })

  it('returns null for an unknown finish rather than guessing', () => {
    expect(priceForFinish(prices, 'glossy')).toBeNull()
  })

  it('never coerces a null price to zero', () => {
    expect(priceForFinish({ usd: null }, 'nonfoil')).toBeNull()
  })

  it('maps every finish to a distinct price key', () => {
    expect(FINISH_PRICE_KEY).toEqual({
      nonfoil: 'usd',
      foil: 'usd_foil',
      etched: 'usd_etched',
    })
  })
})

describe('condition multipliers', () => {
  it('grades NM at full market', () => {
    expect(CONDITION_MULTIPLIER.NM).toBe(1)
  })

  it('covers every condition in CONDITIONS', () => {
    for (const c of CONDITIONS) {
      expect(typeof CONDITION_MULTIPLIER[c.code]).toBe('number')
    }
  })

  it('decreases monotonically from NM to DMG', () => {
    const codes = CONDITIONS.map((c) => c.code)
    expect(codes).toEqual(['NM', 'LP', 'MP', 'HP', 'DMG'])
    for (let i = 1; i < codes.length; i++) {
      expect(CONDITION_MULTIPLIER[codes[i]]).toBeLessThan(
        CONDITION_MULTIPLIER[codes[i - 1]],
      )
    }
  })
})

describe('line values', () => {
  const row = { priceUsd: 10, quantity: 3, condition: 'LP' }

  it('market value ignores condition', () => {
    expect(lineMarketValue(row)).toBe(30)
  })

  it('adjusted value applies the condition multiplier', () => {
    expect(lineAdjustedValue(row)).toBeCloseTo(25.5, 10)
  })

  it('returns null, not zero, for an unpriced row', () => {
    const unpriced = { priceUsd: null, quantity: 4, condition: 'NM' }
    expect(lineMarketValue(unpriced)).toBeNull()
    expect(lineAdjustedValue(unpriced)).toBeNull()
  })

  it('treats an unknown condition as unadjusted rather than dropping the row', () => {
    expect(lineAdjustedValue({ priceUsd: 10, quantity: 1, condition: 'XX' })).toBe(10)
  })

  it('handles a missing quantity as one copy', () => {
    expect(lineMarketValue({ priceUsd: 5, condition: 'NM' })).toBe(5)
  })
})

describe('buylist offers', () => {
  it('pays 60% cash on the condition-adjusted value', () => {
    // 10.00 market, MP (0.70), 2 copies -> 14.00 adjusted -> 8.40 cash
    const row = { priceUsd: 10, quantity: 2, condition: 'MP' }
    expect(buylistCash(row)).toBeCloseTo(8.4, 10)
  })

  it('pays 70% credit on the condition-adjusted value', () => {
    const row = { priceUsd: 10, quantity: 2, condition: 'MP' }
    expect(buylistCredit(row)).toBeCloseTo(9.8, 10)
  })

  it('offers more credit than cash', () => {
    expect(BUYLIST.credit).toBeGreaterThan(BUYLIST.cash)
  })

  it('propagates null for unpriced rows', () => {
    const row = { priceUsd: null, quantity: 1, condition: 'NM' }
    expect(buylistCash(row)).toBeNull()
    expect(buylistCredit(row)).toBeNull()
  })
})

describe('collectionTotals', () => {
  const rows = [
    { priceUsd: 10, quantity: 2, condition: 'NM' }, // 20 market / 20 adj
    { priceUsd: 4, quantity: 1, condition: 'MP' }, //  4 market / 2.8 adj
    { priceUsd: null, quantity: 3, condition: 'NM' }, // unpriced
  ]

  it('sums market and adjusted value across rows', () => {
    const t = collectionTotals(rows)
    expect(t.market).toBeCloseTo(24, 10)
    expect(t.adjusted).toBeCloseTo(22.8, 10)
  })

  it('derives both buylist totals from the adjusted total', () => {
    const t = collectionTotals(rows)
    expect(t.cash).toBeCloseTo(22.8 * 0.6, 10)
    expect(t.credit).toBeCloseTo(22.8 * 0.7, 10)
  })

  it('counts physical cards including unpriced ones', () => {
    expect(collectionTotals(rows).cardCount).toBe(6)
  })

  it('counts unique rows', () => {
    expect(collectionTotals(rows).uniqueCount).toBe(3)
  })

  it('reports unpriced copies separately instead of valuing them at zero', () => {
    const t = collectionTotals(rows)
    expect(t.unpricedCards).toBe(3)
    expect(t.unpricedRows).toBe(1)
  })

  it('returns zeroed totals for an empty collection', () => {
    const t = collectionTotals([])
    expect(t).toMatchObject({
      market: 0,
      adjusted: 0,
      cash: 0,
      credit: 0,
      cardCount: 0,
      uniqueCount: 0,
      unpricedCards: 0,
      unpricedRows: 0,
    })
  })

  it('tolerates a null row list', () => {
    expect(collectionTotals(null).cardCount).toBe(0)
  })
})

describe('formatUsd', () => {
  it('formats a number as dollars', () => {
    expect(formatUsd(1234.5)).toBe('$1,234.50')
  })

  it('renders an em dash for null so unpriced never reads as free', () => {
    expect(formatUsd(null)).toBe('—')
    expect(formatUsd(undefined)).toBe('—')
  })

  it('formats a genuine zero as $0.00', () => {
    expect(formatUsd(0)).toBe('$0.00')
  })
})
