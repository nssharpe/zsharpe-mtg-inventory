/**
 * The only module that talks to Scryfall.
 *
 * Scryfall is public, key-less and CORS-open, so this runs entirely in the
 * browser. They ask for 50–100ms between requests; `throttle` below enforces
 * that globally rather than per-caller.
 */

import { chunk } from './rows.js'

const API = 'https://api.scryfall.com'
const MIN_REQUEST_GAP_MS = 110
const COLLECTION_BATCH_SIZE = 75 // Scryfall's documented cap

let lastRequestAt = 0

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Serialize requests so we never exceed Scryfall's asked-for rate. */
async function throttle() {
  const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
}

export class ScryfallError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ScryfallError'
    this.status = status
  }
}

async function request(path, options = {}) {
  await throttle()

  let response
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: { Accept: 'application/json', ...(options.headers || {}) },
    })
  } catch (cause) {
    throw new ScryfallError('Could not reach Scryfall. Check your connection.', 0)
  }

  if (response.status === 404) return null

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ScryfallError(
      body.details || `Scryfall returned ${response.status}`,
      response.status,
    )
  }

  return response.json()
}

/** Card-name suggestions for the search box. */
export async function autocomplete(query) {
  const q = query.trim()
  if (q.length < 2) return []
  const data = await request(`/cards/autocomplete?q=${encodeURIComponent(q)}`)
  return data?.data ?? []
}

/**
 * Every printing of one card, newest first — this is the grid the user picks from.
 * Printing is where the value lives, so this deliberately does not collapse them.
 */
export async function printingsOf(cardName) {
  const q = `!"${cardName}"`
  const path =
    `/cards/search?q=${encodeURIComponent(q)}` +
    `&unique=prints&order=released&dir=desc&include_extras=true`

  const first = await request(path)
  if (!first) return []

  let cards = first.data ?? []
  let next = first.next_page

  // Guard against a runaway loop on a card with a huge number of printings.
  let pages = 1
  while (next && pages < 5) {
    const url = next.replace(API, '')
    const page = await request(url)
    if (!page) break
    cards = cards.concat(page.data ?? [])
    next = page.next_page
    pages += 1
  }

  return cards
}

/** One card by its printing id — used when opening a row's detail view. */
export async function cardById(scryfallId) {
  return request(`/cards/${scryfallId}`)
}

/**
 * Look up many printings at once for a price refresh.
 *
 * Batches of 75 with the throttle between them. Returns a Map of
 * scryfallId -> card, plus the ids Scryfall could not find, so the caller can
 * leave those rows' prices untouched instead of blanking them.
 *
 * `onProgress({ done, total })` fires after each batch.
 */
export async function fetchCardsByIds(ids, onProgress) {
  const unique = [...new Set(ids.filter(Boolean))]
  const batches = chunk(unique, COLLECTION_BATCH_SIZE)

  const found = new Map()
  const notFound = []
  let done = 0

  for (const batch of batches) {
    const payload = { identifiers: batch.map((id) => ({ id })) }
    const data = await request('/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    for (const card of data?.data ?? []) {
      found.set(card.id, card)
    }
    for (const miss of data?.not_found ?? []) {
      if (miss.id) notFound.push(miss.id)
    }

    done += batch.length
    onProgress?.({ done, total: unique.length })
  }

  return { found, notFound }
}

/** Release year, for labelling a printing in the picker. */
export function releaseYear(card) {
  const date = card?.released_at
  return date ? date.slice(0, 4) : ''
}
