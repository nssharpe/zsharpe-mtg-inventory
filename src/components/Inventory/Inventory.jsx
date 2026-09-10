import { useMemo, useState } from 'react'
import {
  EMPTY_FILTERS,
  applyFilters,
  countNeedingReview,
  facetsFor,
  sortRows,
} from '../../lib/filters.js'
import { collectionTotals } from '../../lib/pricing.js'
import TotalsHeader from './TotalsHeader.jsx'
import Filters from './Filters.jsx'
import { CardGrid, CardTable } from './CardViews.jsx'

export default function Inventory({ rows, onOpen, onDuplicate }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState('value-desc')
  const [view, setView] = useState('grid')

  const facets = useMemo(() => facetsFor(rows), [rows])
  const toReview = useMemo(() => countNeedingReview(rows), [rows])

  function startReview() {
    setFilters({ ...EMPTY_FILTERS, needsReview: true })
    setSort('review-desc')
    setView('grid')
  }
  const visible = useMemo(
    () => sortRows(applyFilters(rows, filters), sort),
    [rows, filters, sort],
  )
  const totals = useMemo(() => collectionTotals(visible), [visible])

  const isFiltered = visible.length !== rows.length

  if (rows.length === 0) {
    return (
      <div className="card-surface p-10 text-center">
        <p className="text-lg font-semibold text-ink-bright">No cards yet</p>
        <p className="mt-1 text-sm text-ink-muted">
          Head to <span className="text-ink-normal">Add cards</span> to start the collection.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {toReview > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border
                        border-accent/50 bg-surface-800 p-4">
          <p className="flex-1 text-sm text-ink-normal">
            <span className="font-semibold text-ink-bright">
              {toReview} card{toReview === 1 ? '' : 's'} still need the printing confirmed.
            </span>{' '}
            These came in from the spreadsheet, which only had names — the set is a
            guess, so the totals below are approximate until they're checked.
          </p>
          <button type="button" onClick={startReview} className="btn-primary">
            Review by value
          </button>
        </div>
      )}

      <TotalsHeader totals={totals} filtered={isFiltered} />

      <Filters
        filters={filters}
        onChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        facets={facets}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Showing {visible.length} of {rows.length} row{rows.length === 1 ? '' : 's'}
        </p>
        <div
          role="group"
          aria-label="View style"
          className="flex gap-1 rounded-lg bg-surface-800 p-1"
        >
          <ViewButton active={view === 'grid'} onClick={() => setView('grid')}>
            Grid
          </ViewButton>
          <ViewButton active={view === 'table'} onClick={() => setView('table')}>
            Table
          </ViewButton>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <p className="text-ink-bright">Nothing matches those filters.</p>
        </div>
      ) : view === 'grid' ? (
        <CardGrid rows={visible} onOpen={onOpen} onDuplicate={onDuplicate} />
      ) : (
        <CardTable rows={visible} onOpen={onOpen} onDuplicate={onDuplicate} />
      )}
    </div>
  )
}

function ViewButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-accent text-surface-900'
          : 'text-ink-muted hover:text-ink-bright'
      }`}
    >
      {children}
    </button>
  )
}
