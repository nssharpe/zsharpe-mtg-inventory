import { useState } from 'react'
import { acceptPrinting, confirmPrinting } from '../lib/inventory.js'
import { formatUsd } from '../lib/pricing.js'
import PrintingPicker from './PrintingPicker.jsx'

/**
 * Shown for rows imported from Kadyn's spreadsheet, where we guessed the
 * printing. The sheet only had names, and printing is where most of the value
 * is — Shivan Dragon alone ranges from $0.10 to $400 — so each of these needs
 * a human with the card in hand.
 *
 * The grid itself lives in PrintingPicker; this supplies the review framing.
 */
export default function ReviewPrinting({ row, onDone }) {
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

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

      <PrintingPicker
        cardName={row.name}
        finish={row.finish}
        currentScryfallId={row.scryfallId}
        onPick={choose}
        disabled={saving}
        currentLabel="guess"
      />

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
