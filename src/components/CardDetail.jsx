import { useEffect, useState } from 'react'
import {
  BUYLIST,
  CONDITIONS,
  buylistCash,
  buylistCredit,
  formatUsd,
  lineAdjustedValue,
  lineMarketValue,
  conditionMultiplier,
} from '../lib/pricing.js'
import { reclassifyRow, removeRow, updateRow } from '../lib/inventory.js'
import { availableFinishes, repriceRow } from '../lib/rows.js'

export default function CardDetail({ row, onClose }) {
  const [quantity, setQuantity] = useState(row.quantity)
  const [condition, setCondition] = useState(row.condition)
  const [finish, setFinish] = useState(row.finish)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Only the finishes this printing actually comes in — offering the others
  // would produce a row with no price at all.
  const finishes = availableFinishes(row)

  // Preview reflects the pending edits, including the price for the chosen
  // finish, so the value updates live as you change grade or finish.
  const preview = {
    ...repriceRow(row, finish),
    quantity: Number(quantity) || 1,
    condition,
  }
  const dirty =
    Number(quantity) !== row.quantity || condition !== row.condition || finish !== row.finish

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (condition !== row.condition || finish !== row.finish) {
        // Finish and condition are part of the row's identity, so this moves
        // the row to a new document (merging if one already exists there).
        await reclassifyRow({ ...row, quantity: Number(quantity) || 1 }, { finish, condition })
      } else {
        await updateRow(row.id, { quantity: Number(quantity) || 1 })
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save changes.')
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await removeRow(row.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not delete.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={row.name}
        className="card-surface max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6"
      >
        <div className="flex flex-col gap-6 sm:flex-row">
          {row.imageNormal && (
            <img
              src={row.imageNormal}
              alt={row.name}
              className="mx-auto w-52 shrink-0 rounded-xl"
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink-bright">{row.name}</h2>
                <p className="text-sm text-ink-muted">
                  {row.setName} · #{row.collectorNumber} ·{' '}
                  <span className="capitalize">{row.rarity}</span>
                </p>
                <p className="text-sm text-ink-muted">{row.typeLine}</p>
              </div>
              <button type="button" onClick={onClose} className="btn-ghost" aria-label="Close">
                ✕
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Field label="Quantity">
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>

              <Field label="Condition">
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
              </Field>

              <Field label="Finish" className="col-span-2">
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
              </Field>
            </div>

            <dl className="mt-5 space-y-1.5 rounded-lg bg-surface-900 p-4 text-sm">
              <Line label="Price each" value={formatUsd(preview.priceUsd)} />
              <Line label="Market total" value={formatUsd(lineMarketValue(preview))} />
              <Line
                label={`Adjusted (${condition})`}
                value={formatUsd(lineAdjustedValue(preview))}
                emphasis
              />
              <Line
                label={`Pandemonium cash (${Math.round(BUYLIST.cash * 100)}%)`}
                value={formatUsd(buylistCash(preview))}
              />
              <Line
                label={`Pandemonium credit (${Math.round(BUYLIST.credit * 100)}%)`}
                value={formatUsd(buylistCredit(preview))}
              />
            </dl>

            {preview.priceUsd === null && (
              <p className="mt-3 text-xs text-amber-300">
                No TCG price for this printing in {finish}. It's excluded from totals.
              </p>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-red-950 border border-red-800
                                          px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={busy || !dirty}
                className="btn-primary"
              >
                {busy ? 'Saving…' : 'Save changes'}
              </button>

              <a
                href={`https://scryfall.com/card/${row.setCode}/${row.collectorNumber}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                Scryfall
              </a>

              <div className="ml-auto">
                {confirmDelete ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-ink-normal">Remove all {row.quantity}?</span>
                    <button
                      type="button"
                      onClick={remove}
                      disabled={busy}
                      className="btn bg-red-600 text-white hover:bg-red-500"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="btn-ghost"
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="btn-ghost text-red-300 hover:bg-red-950 hover:text-red-200"
                  >
                    Remove from collection
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

function Line({ label, value, emphasis }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd
        className={`font-semibold tabular-nums ${
          emphasis ? 'text-accent' : 'text-ink-bright'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
