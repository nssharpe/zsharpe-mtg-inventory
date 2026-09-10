/**
 * The only module that writes Firestore.
 *
 * The collection is shared: both signed-in users read and write the same rows.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'

import { db } from './firebase.js'
import { priceForFinish } from './pricing.js'
import { clampFinish, repriceRow, rowFromCard, rowId } from './rows.js'
import { fetchCardsByIds } from './scryfall.js'

const COLLECTION = 'collection'
const META = 'meta'
const SETTINGS = 'settings'

const FIRESTORE_BATCH_LIMIT = 500

/** Live subscription to the whole collection. Returns an unsubscribe function. */
export function watchInventory(onRows, onError) {
  return onSnapshot(
    collection(db, COLLECTION),
    (snapshot) => {
      onRows(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    },
    onError,
  )
}

/**
 * Add copies of a printing.
 *
 * If a row for this exact printing + finish + condition + language already
 * exists, its quantity goes up; otherwise the row is created. The deterministic
 * id is what makes this safe without a read-then-write.
 */
export async function addCard(card, { finish, condition, quantity = 1, language = 'en', notes = '' }) {
  const row = rowFromCard(card, { finish, condition, quantity, language, notes })
  const id = rowId(row)
  const ref = doc(db, COLLECTION, id)

  const existing = await getDoc(ref)

  if (existing.exists()) {
    await updateDoc(ref, {
      quantity: increment(row.quantity),
      // Refresh the price snapshot while we are here.
      priceUsd: row.priceUsd,
      prices: row.prices,
      finishes: row.finishes,
      priceUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { id, merged: true, added: row.quantity, name: row.name }
  }

  await setDoc(ref, {
    ...row,
    priceUpdatedAt: serverTimestamp(),
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { id, merged: false, added: row.quantity, name: row.name }
}

/** Change quantity, condition, finish or notes on an existing row. */
export async function updateRow(rowIdentifier, changes) {
  await updateDoc(doc(db, COLLECTION, rowIdentifier), {
    ...changes,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Changing finish or condition changes the row's identity, so the row has to
 * move to a new document rather than be edited in place.
 */
export async function reclassifyRow(row, { finish, condition }) {
  // Finish selects which price key applies, so the price has to be recomputed
  // rather than carried across.
  const target = { ...repriceRow(row, finish), condition }
  const newId = rowId(target)

  if (newId === row.id) {
    await updateRow(row.id, { finish, condition, priceUsd: target.priceUsd })
    return newId
  }

  const targetRef = doc(db, COLLECTION, newId)
  const existing = await getDoc(targetRef)
  const batch = writeBatch(db)

  if (existing.exists()) {
    batch.update(targetRef, {
      quantity: increment(row.quantity),
      updatedAt: serverTimestamp(),
    })
  } else {
    const { id: _drop, ...fields } = target
    batch.set(targetRef, { ...fields, updatedAt: serverTimestamp() })
  }

  batch.delete(doc(db, COLLECTION, row.id))
  await batch.commit()
  return newId
}

export async function removeRow(rowIdentifier) {
  await deleteDoc(doc(db, COLLECTION, rowIdentifier))
}

/** Undo for the "recently added" strip: take back the copies just added. */
export async function undoAdd(rowIdentifier, quantity) {
  const ref = doc(db, COLLECTION, rowIdentifier)
  const snap = await getDoc(ref)
  if (!snap.exists()) return

  const current = snap.data().quantity ?? 0
  if (current <= quantity) {
    await deleteDoc(ref)
  } else {
    await updateDoc(ref, {
      quantity: increment(-quantity),
      updatedAt: serverTimestamp(),
    })
  }
}

/**
 * Write refreshed prices back.
 *
 * `found` is the Map from scryfall.fetchCardsByIds. Rows whose printing was not
 * found keep whatever price they already had — a lookup failure is not evidence
 * that a card became worthless.
 */
export async function writeRefreshedPrices(rows, found) {
  const updates = []

  for (const row of rows) {
    const card = found.get(row.scryfallId)
    if (!card) continue

    const price = priceForFinish(card.prices, row.finish)
    const prices = {
      usd: priceForFinish(card.prices, 'nonfoil'),
      usd_foil: priceForFinish(card.prices, 'foil'),
      usd_etched: priceForFinish(card.prices, 'etched'),
    }

    const unchanged =
      price === row.priceUsd &&
      prices.usd === row.prices?.usd &&
      prices.usd_foil === row.prices?.usd_foil &&
      prices.usd_etched === row.prices?.usd_etched
    if (unchanged) continue

    updates.push({ id: row.id, price, prices })
  }

  for (let i = 0; i < updates.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const u of updates.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
      batch.update(doc(db, COLLECTION, u.id), {
        priceUsd: u.price,
        // Kept in step so changing a row's finish later reprices correctly.
        prices: u.prices,
        priceUpdatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }

  await setDoc(
    doc(db, META, SETTINGS),
    { lastPriceRefresh: serverTimestamp() },
    { merge: true },
  )

  return updates.length
}

/**
 * Replace a row's printing once someone confirms which one they actually hold.
 *
 * Almost everything denormalized onto a row is printing-specific — set, art,
 * collector number, rarity, and every price. So this rebuilds the row from the
 * new card through rowFromCard rather than patching scryfallId, which would
 * leave the old set's art and price under the new printing's id.
 *
 * The row's identity changes, so it moves to a new document. addedAt carries
 * across; a row that already exists at the target absorbs the quantity.
 */
export async function confirmPrinting(row, card, { finish, condition } = {}) {
  // The new printing may not come in the finish the row currently has.
  const safeFinish = clampFinish(card, finish ?? row.finish)
  const rebuilt = rowFromCard(card, {
    finish: safeFinish,
    condition: condition ?? row.condition,
    quantity: row.quantity,
    language: row.language ?? 'en',
    notes: row.notes ?? '',
  })

  const newId = rowId(rebuilt)
  const targetRef = doc(db, COLLECTION, newId)
  const existing = await getDoc(targetRef)
  const batch = writeBatch(db)

  if (existing.exists() && newId !== row.id) {
    batch.update(targetRef, {
      quantity: increment(row.quantity),
      needsReview: false,
      updatedAt: serverTimestamp(),
    })
  } else {
    batch.set(targetRef, {
      ...rebuilt,
      // The printing is settled now, so it drops out of the review queue.
      needsReview: false,
      reviewPriority: 0,
      sourceLabel: row.sourceLabel ?? '',
      addedAt: row.addedAt ?? serverTimestamp(),
      priceUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  if (newId !== row.id) batch.delete(doc(db, COLLECTION, row.id))
  await batch.commit()
  return {
    id: newId,
    merged: existing.exists() && newId !== row.id,
    finish: safeFinish,
  }
}

/**
 * Add a second entry for a card already in the collection, in a different
 * printing, finish or condition.
 *
 * Deliberately not confirmPrinting: that one *moves* a row and deletes the
 * source document. This leaves the original alone.
 *
 * A copy that lands on a combination already owned merges into it, because
 * that combination is the row's identity — so this reports whether it created
 * a new entry or added to an existing one, and the caller says so. Otherwise a
 * merge looks like the button did nothing.
 */
export async function duplicateRow(row, card, { finish, condition, quantity = 1 } = {}) {
  const safeFinish = clampFinish(card, finish ?? row.finish)
  const built = rowFromCard(card, {
    finish: safeFinish,
    condition: condition ?? row.condition,
    quantity,
    language: row.language ?? 'en',
    notes: '',
  })

  const newId = rowId(built)
  const targetRef = doc(db, COLLECTION, newId)
  const existing = await getDoc(targetRef)

  if (existing.exists()) {
    await updateDoc(targetRef, {
      quantity: increment(built.quantity),
      updatedAt: serverTimestamp(),
    })
    return {
      id: newId,
      merged: true,
      finish: safeFinish,
      quantity: (existing.data()?.quantity ?? 0) + built.quantity,
    }
  }

  await setDoc(targetRef, {
    ...built,
    // A copy is its own entry: it didn't come from the sheet, its printing was
    // chosen deliberately, and "date added" should be now rather than whenever
    // the row it was copied from was created.
    needsReview: false,
    reviewPriority: 0,
    sourceLabel: '',
    addedAt: serverTimestamp(),
    priceUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return { id: newId, merged: false, finish: safeFinish, quantity: built.quantity }
}

/** Accept the guessed printing as-is. */
export async function acceptPrinting(rowIdentifier) {
  await updateDoc(doc(db, COLLECTION, rowIdentifier), {
    needsReview: false,
    reviewPriority: 0,
    updatedAt: serverTimestamp(),
  })
}

/**
 * One-time import of Kadyn's spreadsheet.
 *
 * The seed carries ids only. Cards are fetched here so prices are current at
 * import time, and rows are built with rowFromCard so the import uses the exact
 * same code path as the add flow.
 *
 * Written with set() rather than addCard(), so re-running is a no-op instead of
 * doubling every quantity.
 */
export async function importSeed(seed, onProgress) {
  const ids = [...new Set(seed.map((s) => s.scryfallId))]
  const { found, notFound } = await fetchCardsByIds(ids, (p) =>
    onProgress?.({ phase: 'fetching', ...p }),
  )

  const rows = []
  const missing = []

  for (const entry of seed) {
    const card = found.get(entry.scryfallId)
    if (!card) {
      missing.push(entry.sourceLabel || entry.scryfallId)
      continue
    }
    const row = rowFromCard(card, {
      finish: entry.finish,
      condition: entry.condition,
      quantity: entry.quantity,
    })
    rows.push({
      id: rowId(row),
      data: {
        ...row,
        needsReview: entry.needsReview === true,
        reviewPriority: entry.reviewPriority ?? 0,
        sourceLabel: entry.sourceLabel ?? '',
      },
    })
  }

  let written = 0
  for (let i = 0; i < rows.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const r of rows.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
      batch.set(doc(db, COLLECTION, r.id), {
        ...r.data,
        priceUpdatedAt: serverTimestamp(),
        addedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
    written += Math.min(FIRESTORE_BATCH_LIMIT, rows.length - i)
    onProgress?.({ phase: 'writing', done: written, total: rows.length })
  }

  await setDoc(
    doc(db, META, SETTINGS),
    { lastPriceRefresh: serverTimestamp() },
    { merge: true },
  )

  return { written, missing, notFound }
}

export async function getLastRefresh() {
  const snap = await getDoc(doc(db, META, SETTINGS))
  return snap.exists() ? snap.data().lastPriceRefresh ?? null : null
}
