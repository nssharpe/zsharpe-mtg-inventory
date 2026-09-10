import { useState } from 'react'
import { duplicateRow } from '../lib/inventory.js'
import { CONDITIONS, conditionMultiplier } from '../lib/pricing.js'
import { availableFinishes } from '../lib/rows.js'
import PrintingPicker from './PrintingPicker.jsx'

/**
 * Add another entry for a card already in the collection.
 *
 * A row is identified by printing + finish + condition, so a copy is only a
 * separate entry if one of those differs — which is exactly the case this is
 * for: the same card owned in a second printing or a worse grade. Set the
 * grade and finish here, then click the printing to file it under.
 *
 * Clicking the printing already highlighted is legitimate: same printing,
 * different condition is still a new row.
 */
export default function DuplicateEntry({ row, onCancel }) {
  const [quantity, setQuantity] = useState(1)
  const [condition, setCondition] = useState(row.condition)
  const [finish, setFinish] = useState(row.finish)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const finishes = availableFinishes(row)

  async function choose(card) {
    setSaving(true)
    setError(null)
    setResult(null)
    try {
      const outcome = await duplicateRow(row, card, {
        finish,
        condition,
        quantity: Number(quantity) || 1,
      })
      setResult(describe(outcome, card, { finish, condition }))
    } catch (err) {
      setError(err.message || 'Could not add the copy.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-surface-500 bg-surface-900 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-bright">
          Add another copy of {row.name}
        </h3>
        <button type="button" onClick={onCancel} className="btn-ghost" disabled={saving}>
          Done
        </button>
      </div>

      <p className="mt-1 text-xs text-ink-muted">
        Set the grade and finish for the copy, then click the printing it is.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Quantity</span>
          <input
            type="number"
            min="1"
            className="input"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="label">Condition</span>
          <select
            className="input"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          >
            {CONDITIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label} ({Math.round(conditionMultiplier(c.code) * 100)}%)
              </option>
            ))}
          </select>
        </label>

        <div className="col-span-2">
          <span className="label">Finish</span>
          <div className="flex gap-1.5">
            {finishes.map((f) => (
              <button
                key={f.code}
                type="button"
                onClick={() => setFinish(f.code)}
                className={finish === f.code ? 'chip-on' : 'chip-off'}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-800 bg-red-950
                                    px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {result && (
        <p role="status" className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950
                                     px-3 py-2 text-sm text-emerald-300">
          {result}
        </p>
      )}

      <PrintingPicker
        cardName={row.name}
        finish={finish}
        currentScryfallId={row.scryfallId}
        onPick={choose}
        disabled={saving}
        currentLabel="this one"
      />
    </section>
  )
}

/**
 * A copy landing on a combination already owned merges into it. That's right
 * for this data model but looks like nothing happened, so name the outcome.
 */
function describe(outcome, card, { finish: wantedFinish, condition }) {
  const where = `${card.set_name} · #${card.collector_number}`
  const parts = [
    outcome.merged
      ? `Added to the ${where} entry you already had — ${outcome.quantity} there now.`
      : `Added a new entry: ${where} — ${outcome.finish}, ${condition}.`,
  ]
  if (outcome.finish !== wantedFinish) {
    parts.push(`That printing doesn’t come in ${wantedFinish}, so it was filed as ${outcome.finish}.`)
  }
  return parts.join(' ')
}
