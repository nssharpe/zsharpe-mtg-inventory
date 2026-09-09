import { useEffect, useRef, useState } from 'react'
import { autocomplete, printingsOf, releaseYear } from '../../lib/scryfall.js'
import { availableFinishes } from '../../lib/rows.js'
import { CONDITIONS, formatUsd, priceForFinish } from '../../lib/pricing.js'
import { addCard, undoAdd } from '../../lib/inventory.js'

const MAX_RECENT = 6

export default function AddCard() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [printings, setPrintings] = useState([])
  const [chosenName, setChosenName] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [recent, setRecent] = useState([])

  const suggestionSeq = useRef(0)

  // Debounced autocomplete. A sequence number drops responses that arrive out
  // of order, which is easy to hit when typing fast.
  useEffect(() => {
    if (query.trim().length < 2 || query === chosenName) {
      setSuggestions([])
      return
    }
    const seq = ++suggestionSeq.current
    const timer = setTimeout(async () => {
      try {
        const names = await autocomplete(query)
        if (seq === suggestionSeq.current) setSuggestions(names.slice(0, 10))
      } catch {
        /* suggestions are optional; typing the full name still works */
      }
    }, 220)
    return () => clearTimeout(timer)
  }, [query, chosenName])

  async function loadPrintings(name) {
    setChosenName(name)
    setQuery(name)
    setSuggestions([])
    setSelected(null)
    setPrintings([])
    setError(null)
    setLoading(true)
    try {
      const cards = await printingsOf(name)
      setPrintings(cards)
      if (cards.length === 0) setError(`No printings found for "${name}".`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(card, options) {
    try {
      const result = await addCard(card, options)
      setRecent((prev) => [
        {
          key: `${result.id}-${Date.now()}`,
          rowId: result.id,
          name: result.name,
          setCode: card.set,
          quantity: result.added,
          finish: options.finish,
          condition: options.condition,
          image: card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small ?? '',
        },
        ...prev,
      ].slice(0, MAX_RECENT))
      setSelected(null)
    } catch (err) {
      setError(err.message || 'Could not save that card.')
    }
  }

  async function handleUndo(entry) {
    try {
      await undoAdd(entry.rowId, entry.quantity)
      setRecent((prev) => prev.filter((r) => r.key !== entry.key))
    } catch (err) {
      setError(err.message || 'Could not undo.')
    }
  }

  return (
    <div className="space-y-6">
      <section className="card-surface p-5">
        <label htmlFor="card-search" className="label">Card name</label>
        <div className="relative">
          <input
            id="card-search"
            className="input"
            placeholder="Start typing a card name…"
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && suggestions.length > 0) {
                e.preventDefault()
                loadPrintings(suggestions[0])
              }
            }}
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border
                           border-surface-500 bg-surface-800 shadow-xl">
              {suggestions.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => loadPrintings(name)}
                    className="w-full px-3 py-2 text-left text-sm text-ink-normal
                               hover:bg-surface-600 hover:text-ink-bright"
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Pick the exact printing next — set and finish are where most of the value is.
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-ink-muted">Loading printings…</p>}

      {printings.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-bright">
            {printings.length} printing{printings.length === 1 ? '' : 's'} of {chosenName}
          </h2>
          <PrintingGrid
            printings={printings}
            selectedId={selected?.id}
            onSelect={setSelected}
          />
        </section>
      )}

      {selected && (
        <AddPanel
          card={selected}
          onAdd={handleAdd}
          onCancel={() => setSelected(null)}
        />
      )}

      {recent.length > 0 && (
        <RecentlyAdded entries={recent} onUndo={handleUndo} />
      )}
    </div>
  )
}

function PrintingGrid({ printings, selectedId, onSelect }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {printings.map((card) => {
        const image =
          card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? ''
        const isSelected = card.id === selectedId
        // Show the nonfoil price as the headline, with foil alongside when the
        // printing comes in foil at all.
        const finishes = availableFinishes(card).map((f) => f.code)
        const price = finishes.includes('nonfoil')
          ? priceForFinish(card.prices, 'nonfoil')
          : priceForFinish(card.prices, finishes[0])
        const foilPrice = finishes.includes('foil') && finishes.includes('nonfoil')
          ? priceForFinish(card.prices, 'foil')
          : null

        return (
          <li key={card.id}>
            <button
              type="button"
              onClick={() => onSelect(card)}
              aria-pressed={isSelected}
              className={`group w-full overflow-hidden rounded-xl border text-left transition
                ${isSelected
                  ? 'border-accent ring-2 ring-accent'
                  : 'border-surface-600 hover:border-surface-500'}`}
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
              <div className="bg-surface-800 p-2">
                <p className="truncate text-xs font-semibold text-ink-bright">
                  {card.set_name}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {card.set?.toUpperCase()} · #{card.collector_number} · {releaseYear(card)}
                </p>
                <p className="mt-1 text-xs font-semibold text-accent">
                  {formatUsd(price)}
                  {foilPrice !== null && (
                    <span className="ml-1.5 font-normal text-ink-muted">
                      foil {formatUsd(foilPrice)}
                    </span>
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

function AddPanel({ card, onAdd, onCancel }) {
  const finishes = availableFinishes(card)
  const [finish, setFinish] = useState(finishes[0].code)
  const [condition, setCondition] = useState('NM')
  const [quantity, setQuantity] = useState(1)
  const [saving, setSaving] = useState(false)

  // A different printing may not offer the finish that was selected before.
  useEffect(() => {
    if (!finishes.some((f) => f.code === finish)) setFinish(finishes[0].code)
  }, [card.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const price = priceForFinish(card.prices, finish)

  async function submit() {
    setSaving(true)
    await onAdd(card, { finish, condition, quantity: Number(quantity) })
    setSaving(false)
    setQuantity(1)
  }

  return (
    <section className="card-surface sticky bottom-4 z-10 p-5 shadow-2xl">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[12rem] flex-1">
          <p className="text-sm font-semibold text-ink-bright">{card.name}</p>
          <p className="text-xs text-ink-muted">
            {card.set_name} · #{card.collector_number}
          </p>
        </div>

        <div>
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

        <div>
          <label htmlFor="condition" className="label">Condition</label>
          <select
            id="condition"
            className="input"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          >
            {CONDITIONS.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="w-24">
          <label htmlFor="quantity" className="label">Qty</label>
          <input
            id="quantity"
            type="number"
            min="1"
            className="input"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div>
          <span className="label">Each</span>
          <p className="py-2 text-lg font-bold text-accent">{formatUsd(price)}</p>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Adding…' : 'Add to collection'}
          </button>
        </div>
      </div>

      {price === null && (
        <p className="mt-3 text-xs text-amber-300">
          No TCG price for this finish — it'll be added to the collection but left out of totals.
        </p>
      )}
    </section>
  )
}

function RecentlyAdded({ entries, onUndo }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-ink-bright">Just added</h2>
      <ul className="flex flex-wrap gap-2">
        {entries.map((entry) => (
          <li
            key={entry.key}
            className="flex items-center gap-2 rounded-lg border border-surface-600
                       bg-surface-800 py-1.5 pl-1.5 pr-3"
          >
            {entry.image && (
              <img src={entry.image} alt="" className="h-10 w-7 rounded object-cover" />
            )}
            <div className="text-xs">
              <p className="font-medium text-ink-bright">
                {entry.quantity}× {entry.name}
              </p>
              <p className="text-ink-muted">
                {entry.setCode?.toUpperCase()} · {entry.finish} · {entry.condition}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUndo(entry)}
              className="ml-1 text-xs font-medium text-ink-muted underline
                         hover:text-ink-bright"
            >
              Undo
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
