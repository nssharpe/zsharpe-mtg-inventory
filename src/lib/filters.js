/**
 * Filtering and sorting the inventory. Pure — operates on rows already in memory,
 * which is why the card metadata is denormalized onto each row.
 */

import { lineAdjustedValue } from './pricing.js'

export const COLORS = [
  { code: 'W', label: 'White', hex: '#f8f0d8' },
  { code: 'U', label: 'Blue', hex: '#3d7dc4' },
  { code: 'B', label: 'Black', hex: '#4a4351' },
  { code: 'R', label: 'Red', hex: '#d3542f' },
  { code: 'G', label: 'Green', hex: '#3d8a55' },
  { code: 'C', label: 'Colorless', hex: '#9aa3b8' },
]

export const RARITIES = ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus']

const RARITY_ORDER = {
  common: 0,
  uncommon: 1,
  rare: 2,
  special: 3,
  mythic: 4,
  bonus: 5,
}

/** Ordered most-specific first, so "Artifact Creature" reads as a Creature. */
const TYPE_PRIORITY = [
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Land',
]

export const EMPTY_FILTERS = {
  search: '',
  // Only rows still awaiting a printing confirmation (from the sheet import).
  needsReview: false,
  colors: [],
  types: [],
  rarities: [],
  sets: [],
  finishes: [],
  conditions: [],
}

export const SORTS = [
  { key: 'value-desc', label: 'Value (high to low)' },
  { key: 'value-asc', label: 'Value (low to high)' },
  { key: 'name-asc', label: 'Name (A–Z)' },
  { key: 'name-desc', label: 'Name (Z–A)' },
  { key: 'cmc-asc', label: 'Mana value (low to high)' },
  { key: 'cmc-desc', label: 'Mana value (high to low)' },
  { key: 'rarity-desc', label: 'Rarity (mythic first)' },
  { key: 'set-asc', label: 'Set' },
  { key: 'added-desc', label: 'Recently added' },
  { key: 'qty-desc', label: 'Quantity (most first)' },
  { key: 'review-desc', label: 'Most worth reviewing' },
]

const DEFAULT_SORT = 'value-desc'

/** The headline type of a card, e.g. "Legendary Creature — Praetor" -> "Creature". */
export function primaryTypeOf(typeLine) {
  if (!typeLine) return 'Other'
  const front = String(typeLine).split('—')[0]
  const hit = TYPE_PRIORITY.find((t) => front.includes(t))
  return hit || 'Other'
}

function matchesAny(selected, value) {
  return selected.length === 0 || selected.includes(value)
}

export function matchesFilters(row, filters) {
  const f = { ...EMPTY_FILTERS, ...filters }

  if (f.search) {
    const needle = f.search.trim().toLowerCase()
    const haystack = `${row.name ?? ''} ${row.setName ?? ''} ${row.typeLine ?? ''}`.toLowerCase()
    if (!haystack.includes(needle)) return false
  }

  if (f.colors.length > 0) {
    const identity = row.colorIdentity ?? []
    // "Colorless" is a pseudo-colour: an empty identity, not a letter.
    const wantsColorless = f.colors.includes('C')
    const isColorless = identity.length === 0
    const letterMatch = f.colors.some((c) => c !== 'C' && identity.includes(c))
    if (!(letterMatch || (wantsColorless && isColorless))) return false
  }

  if (!matchesAny(f.types, primaryTypeOf(row.typeLine))) return false
  if (!matchesAny(f.rarities, row.rarity)) return false
  if (!matchesAny(f.sets, row.setCode)) return false
  if (!matchesAny(f.finishes, row.finish)) return false
  if (!matchesAny(f.conditions, row.condition)) return false

  // Rows added through the normal flow have no needsReview field at all, and
  // must not be swept into the review queue.
  if (f.needsReview && row.needsReview !== true) return false

  return true
}

/** How many rows still need their printing confirmed. */
export function countNeedingReview(rows) {
  if (!Array.isArray(rows)) return 0
  return rows.filter((r) => r.needsReview === true).length
}

export function applyFilters(rows, filters) {
  if (!Array.isArray(rows)) return []
  return rows.filter((row) => matchesFilters(row, filters))
}

/**
 * Unpriced rows always sink to the bottom, in both directions — a card whose
 * price we don't know shouldn't lead a "cheapest first" list as if it were free.
 */
function compareByValue(a, b, direction) {
  const av = lineAdjustedValue(a)
  const bv = lineAdjustedValue(b)
  if (av === null && bv === null) return 0
  if (av === null) return 1
  if (bv === null) return -1
  return direction === 'asc' ? av - bv : bv - av
}

const COMPARATORS = {
  'value-desc': (a, b) => compareByValue(a, b, 'desc'),
  'value-asc': (a, b) => compareByValue(a, b, 'asc'),
  'name-asc': (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
  'name-desc': (a, b) => (b.name ?? '').localeCompare(a.name ?? ''),
  'cmc-asc': (a, b) => (a.cmc ?? 0) - (b.cmc ?? 0),
  'cmc-desc': (a, b) => (b.cmc ?? 0) - (a.cmc ?? 0),
  'rarity-desc': (a, b) => (RARITY_ORDER[b.rarity] ?? -1) - (RARITY_ORDER[a.rarity] ?? -1),
  'set-asc': (a, b) =>
    (a.setName ?? '').localeCompare(b.setName ?? '') ||
    (a.collectorNumber ?? '').localeCompare(b.collectorNumber ?? '', undefined, { numeric: true }),
  'added-desc': (a, b) => toMillis(b.addedAt) - toMillis(a.addedAt),
  'qty-desc': (a, b) => (b.quantity ?? 0) - (a.quantity ?? 0),
  // Dollars at stake if the guessed printing is wrong, biggest first, so the
  // cards that actually move the total get reviewed before the bulk.
  'review-desc': (a, b) => (b.reviewPriority ?? 0) - (a.reviewPriority ?? 0),
}

/** Firestore Timestamps, Dates and plain numbers all show up here. */
function toMillis(value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return 0
}

export function sortRows(rows, sortKey) {
  if (!Array.isArray(rows)) return []
  const comparator = COMPARATORS[sortKey] || COMPARATORS[DEFAULT_SORT]
  return [...rows].sort(comparator)
}

/** The filter options actually present in this collection, so we show no dead choices. */
export function facetsFor(rows) {
  const list = Array.isArray(rows) ? rows : []

  const setMap = new Map()
  const types = new Set()
  const rarities = new Set()

  for (const row of list) {
    if (row.setCode) setMap.set(row.setCode, row.setName || row.setCode)
    types.add(primaryTypeOf(row.typeLine))
    if (row.rarity) rarities.add(row.rarity)
  }

  return {
    sets: [...setMap.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    types: [...types].sort(
      (a, b) => TYPE_PRIORITY.indexOf(a) - TYPE_PRIORITY.indexOf(b) || a.localeCompare(b),
    ),
    rarities: RARITIES.filter((r) => rarities.has(r)),
  }
}
