import { useState } from 'react'
import { confirmPrinting } from '../lib/inventory.js'
import PrintingPicker from './PrintingPicker.jsx'

/**
 * Move an existing row onto a different printing — the same grid the import
 * review uses, without the "we guessed this" framing.
 *
 * The row keeps its quantity and condition; only the printing (and the art,
 * set and price that come with it) changes.
 */
export default function ChangePrinting({ row, onDone, onCancel }) {
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function choose(card) {
    if (card.id === row.scryfallId) {
      onCancel()
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await confirmPrinting(row, card, { finish: row.finish })
      onDone(describe(result, card, row))
    } catch (err) {
      setError(err.message || 'Could not change the printing.')
      setSaving(false)
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-surface-500 bg-surface-900 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-bright">Which printing is this?</h3>
        <button type="button" onClick={onCancel} className="btn-ghost" disabled={saving}>
          Cancel
        </button>
      </div>

      <p className="mt-1 text-xs text-ink-muted">
        Currently <span className="text-ink-normal">{row.setName}</span> · #
        {row.collectorNumber}. Picking a different one keeps your quantity and
        condition, and updates the art and price.
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
      />
    </section>
  )
}

/** Say what actually happened — a merge otherwise looks like a no-op. */
function describe(result, card, row) {
  const where = `${card.set_name} · #${card.collector_number}`
  const parts = [
    result.merged
      ? `Moved to ${where} and merged with the copies already there.`
      : `Now ${where}.`,
  ]
  if (result.finish !== row.finish) {
    parts.push(`That printing doesn’t come in ${row.finish}, so it’s ${result.finish} now.`)
  }
  return parts.join(' ')
}
