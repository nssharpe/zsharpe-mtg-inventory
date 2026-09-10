import { useEffect, useState } from 'react'
import { printingsOf, releaseYear } from '../lib/scryfall.js'
import { formatUsd, priceForFinish } from '../lib/pricing.js'

/**
 * Grid of every printing of one card.
 *
 * Extracted from ReviewPrinting so it can serve three jobs that all need the
 * same grid but different framing: confirming an imported guess, changing the
 * printing on a row that's already correct, and picking the printing for a
 * copy. Deliberately carries no review vocabulary — the caller supplies that.
 */
export default function PrintingPicker({
  cardName,
  finish,
  currentScryfallId,
  onPick,
  disabled = false,
  currentLabel = 'current',
}) {
  const [printings, setPrintings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    printingsOf(cardName)
      .then((cards) => live && setPrintings(cards))
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [cardName])

  if (error) {
    return (
      <p role="alert" className="mt-3 rounded-lg border border-red-800 bg-red-950
                                  px-3 py-2 text-sm text-red-200">
        Couldn’t load printings: {error}
      </p>
    )
  }

  if (loading) return <p className="mt-4 text-sm text-ink-muted">Loading printings…</p>

  if (printings.length === 0) {
    return <p className="mt-4 text-sm text-ink-muted">No printings found for {cardName}.</p>
  }

  return (
    <ul className="mt-3 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1
                   sm:grid-cols-3 lg:grid-cols-4">
      {printings.map((card) => {
        const image =
          card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small ?? ''
        const price = priceForFinish(card.prices, finish)
        const isCurrent = card.id === currentScryfallId
        // Flagged so the user knows before clicking that the finish will change.
        const hasFinish = (card.finishes ?? ['nonfoil']).includes(finish)

        return (
          <li key={card.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(card)}
              className={`w-full overflow-hidden rounded-lg border text-left transition
                disabled:opacity-50
                ${isCurrent
                  ? 'border-accent ring-1 ring-accent'
                  : 'border-surface-600 hover:border-accent'}`}
            >
              {image ? (
                <img
                  src={image}
                  alt={`${card.name} — ${card.set_name}`}
                  loading="lazy"
                  className="aspect-[488/680] w-full object-cover"
                />
              ) : (
                <div className="aspect-[488/680] w-full bg-surface-700" />
              )}
              <div className="bg-surface-800 p-1.5">
                <p className="truncate text-[11px] font-semibold text-ink-bright">
                  {card.set_name}
                </p>
                <p className="text-[10px] text-ink-muted">
                  {card.set?.toUpperCase()} · #{card.collector_number} ·{' '}
                  {releaseYear(card)}
                </p>
                <p className="text-[11px] font-bold text-accent">
                  {hasFinish ? formatUsd(price) : <span className="text-ink-muted">no {finish}</span>}
                  {isCurrent && (
                    <span className="ml-1 font-normal text-ink-muted">{currentLabel}</span>
                  )}
                </p>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
