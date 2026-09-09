import { useEffect, useState } from 'react'
import { printingsOf, releaseYear } from '../lib/scryfall.js'
import { acceptPrinting, confirmPrinting } from '../lib/inventory.js'
import { formatUsd, priceForFinish } from '../lib/pricing.js'

/**
 * Shown for rows imported from Kadyn's spreadsheet, where we guessed the
 * printing. The sheet only had names, and printing is where most of the value
 * is — Shivan Dragon alone ranges from $0.10 to $400 — so each of these needs
 * a human with the card in hand.
 *
 * The printings for this card are loaded up front, so confirming is one click.
 */
export default function ReviewPrinting({ row, onDone }) {
  const [printings, setPrintings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    setLoading(true)
    printingsOf(row.name)
      .then((cards) => live && setPrintings(cards))
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [row.name])

  async function choose(card) {
    setSaving(true)
    setError(null)
    try {
      await confirmPrinting(row, card)
      onDone()
    } catch (err) {
      setError(err.message || 'Could not save that printing.')
      setSaving(false)
    }
  }

  async function keepGuess() {
    setSaving(true)
    try {
      await acceptPrinting(row.id)
      onDone()
    } catch (err) {
      setError(err.message || 'Could not confirm.')
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-accent/50 bg-surface-900 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-bright">
          Which printing is this?
        </h3>
        {row.reviewPriority > 0 && (
          <span className="text-xs text-ink-muted">
            up to {formatUsd(row.reviewPriority)} riding on the answer
          </span>
        )}
      </div>

      {row.sourceLabel && (
        <p className="mt-1 text-xs text-ink-muted">
          From the sheet as <span className="text-ink-normal">“{row.sourceLabel}”</span>
        </p>
      )}

      <p className="mt-2 text-xs text-ink-muted">
        Currently guessed as <span className="text-ink-normal">{row.setName}</span> —
        the most recent printing. Pick the real one, or keep the guess.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-800 bg-red-950
                                    px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-ink-muted">Loading printings…</p>
      ) : (
        <ul className="mt-3 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1
                       sm:grid-cols-3 lg:grid-cols-4">
          {printings.map((card) => {
            const image =
              card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small ?? ''
            const price = priceForFinish(card.prices, row.finish)
            const isGuess = card.id === row.scryfallId

            return (
              <li key={card.id}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => choose(card)}
                  className={`w-full overflow-hidden rounded-lg border text-left transition
                    disabled:opacity-50
                    ${isGuess
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
                      {formatUsd(price)}
                      {isGuess && (
                        <span className="ml-1 font-normal text-ink-muted">guess</span>
                      )}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={keepGuess}
          disabled={saving}
          className="btn-secondary"
        >
          {saving ? 'Saving…' : 'Keep the guess'}
        </button>
      </div>
    </section>
  )
}
