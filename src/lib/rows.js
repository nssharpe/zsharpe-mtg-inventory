/**
 * Turning Scryfall card objects into inventory rows, and back again.
 * Pure — no network, no Firestore.
 */

import { FINISHES, FINISH_PRICE_KEY, priceForFinish } from './pricing.js'

/**
 * A row is one printing, in one finish, in one condition, in one language.
 * The id is derived from exactly those four things so that adding a card you
 * already own resolves to the same document and merges, with no read-then-write
 * race. Firestore document ids cannot contain "/" and cannot be "." or "..".
 */
export function rowId({ scryfallId, finish, condition, language = 'en' }) {
  return [scryfallId, finish, condition, language || 'en']
    .map((part) => String(part ?? '').replace(/[^a-zA-Z0-9_-]/g, ''))
    .join('__')
}

/** Front face image for double-faced cards, which have no top-level image_uris. */
function imagesOf(card) {
  const direct = card?.image_uris
  if (direct) return direct
  const front = card?.card_faces?.[0]?.image_uris
  return front || {}
}

/** The finishes this printing actually comes in, and that we know how to price. */
export function availableFinishes(card) {
  const codes = Array.isArray(card?.finishes) && card.finishes.length
    ? card.finishes
    : ['nonfoil']
  const known = codes.filter((code) => code in FINISH_PRICE_KEY)
  const usable = known.length ? known : ['nonfoil']
  return FINISHES.filter((f) => usable.includes(f.code))
}

/**
 * Build the Firestore row for a card the user just picked.
 *
 * Card metadata is denormalized on purpose: Firestore cannot join against
 * Scryfall, so copying it here is what lets the inventory view filter and sort
 * hundreds of rows with no network calls. Only the price goes stale.
 *
 * Every field gets a concrete value — Firestore rejects `undefined`.
 */
export function rowFromCard(card, { finish, condition, quantity = 1, language = 'en', notes = '' }) {
  const images = imagesOf(card)
  const qty = Number(quantity)

  return {
    scryfallId: card?.id ?? '',
    oracleId: card?.oracle_id ?? '',

    name: card?.name ?? '',
    setCode: card?.set ?? '',
    setName: card?.set_name ?? '',
    collectorNumber: card?.collector_number ?? '',
    colorIdentity: card?.color_identity ?? [],
    typeLine: card?.type_line ?? '',
    rarity: card?.rarity ?? '',
    cmc: typeof card?.cmc === 'number' ? card.cmc : 0,
    imageSmall: images.small ?? '',
    imageNormal: images.normal ?? images.large ?? images.small ?? '',

    finish,
    condition,
    language: language || 'en',
    quantity: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1,
    notes: notes ?? '',

    priceUsd: priceForFinish(card?.prices, finish),
  }
}

/** Split a list into groups of at most `size` (Scryfall caps collection lookups at 75). */
export function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size))
  }
  return out
}
