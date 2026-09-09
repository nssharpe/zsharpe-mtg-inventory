/**
 * All money logic lives here, and nothing here touches the network or Firestore.
 *
 * Prices come from Scryfall, which republishes TCGplayer *market* prices daily.
 * Market price is a Near Mint price, so condition discounts it.
 *
 * If Pandemonium turns out to quote off TCG low or mid rather than market, or
 * their percentages change, BUYLIST below is the only thing that needs editing.
 */

/** Which Scryfall price key holds the USD price for a given finish. */
export const FINISH_PRICE_KEY = {
  nonfoil: 'usd',
  foil: 'usd_foil',
  etched: 'usd_etched',
}

export const FINISHES = [
  { code: 'nonfoil', label: 'Normal' },
  { code: 'foil', label: 'Foil' },
  { code: 'etched', label: 'Etched' },
]

/** Ordered best to worst. The UI renders them in this order. */
export const CONDITIONS = [
  { code: 'NM', label: 'Near Mint' },
  { code: 'LP', label: 'Lightly Played' },
  { code: 'MP', label: 'Moderately Played' },
  { code: 'HP', label: 'Heavily Played' },
  { code: 'DMG', label: 'Damaged' },
]

/** Fraction of Near Mint market price a card in each condition is worth. */
export const CONDITION_MULTIPLIER = {
  NM: 1.0,
  LP: 0.85,
  MP: 0.7,
  HP: 0.5,
  DMG: 0.35,
}

/**
 * What Pandemonium pays in person, as a fraction of condition-adjusted value.
 * A shop grades the physical card at the counter, so these apply to the
 * adjusted value rather than raw market.
 */
export const BUYLIST = {
  cash: 0.6, // paid by check
  credit: 0.7, // store credit
}

/**
 * Pull the USD price for one finish out of a Scryfall `prices` object.
 * Returns null — never 0 — when there is no price, so that "we don't know"
 * stays distinguishable from "it's worthless".
 */
export function priceForFinish(prices, finish) {
  if (!prices) return null
  const key = FINISH_PRICE_KEY[finish]
  if (!key) return null
  const raw = prices[key]
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function quantityOf(row) {
  const q = Number(row?.quantity)
  return Number.isFinite(q) && q > 0 ? q : 1
}

/** Condition multiplier, defaulting to 1 so an unknown grade never hides a row. */
export function conditionMultiplier(condition) {
  const m = CONDITION_MULTIPLIER[condition]
  return typeof m === 'number' ? m : 1
}

/** Full TCG market value of a row, ignoring condition. Null if unpriced. */
export function lineMarketValue(row) {
  if (row?.priceUsd === null || row?.priceUsd === undefined) return null
  return row.priceUsd * quantityOf(row)
}

/** Market value discounted for condition. Null if unpriced. */
export function lineAdjustedValue(row) {
  const market = lineMarketValue(row)
  if (market === null) return null
  return market * conditionMultiplier(row.condition)
}

export function buylistCash(row) {
  const adjusted = lineAdjustedValue(row)
  return adjusted === null ? null : adjusted * BUYLIST.cash
}

export function buylistCredit(row) {
  const adjusted = lineAdjustedValue(row)
  return adjusted === null ? null : adjusted * BUYLIST.credit
}

/**
 * Roll a list of inventory rows into the numbers shown above the collection.
 * Unpriced rows are counted and reported, never silently valued at zero.
 */
export function collectionTotals(rows) {
  const list = Array.isArray(rows) ? rows : []

  let market = 0
  let adjusted = 0
  let cardCount = 0
  let unpricedCards = 0
  let unpricedRows = 0

  for (const row of list) {
    const qty = quantityOf(row)
    cardCount += qty

    const rowMarket = lineMarketValue(row)
    if (rowMarket === null) {
      unpricedRows += 1
      unpricedCards += qty
      continue
    }
    market += rowMarket
    adjusted += lineAdjustedValue(row)
  }

  return {
    market,
    adjusted,
    cash: adjusted * BUYLIST.cash,
    credit: adjusted * BUYLIST.credit,
    cardCount,
    uniqueCount: list.length,
    unpricedCards,
    unpricedRows,
  }
}

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/** Format for display. Null renders as an em dash, never as $0.00. */
export function formatUsd(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return usdFormatter.format(value)
}
