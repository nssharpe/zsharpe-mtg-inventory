import { COLORS, EMPTY_FILTERS, SORTS } from '../../lib/filters.js'
import { CONDITIONS, FINISHES } from '../../lib/pricing.js'

/** Toggle one value in and out of a multi-select filter array. */
function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export default function Filters({ filters, onChange, sort, onSortChange, facets }) {
  const set = (patch) => onChange({ ...filters, ...patch })
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <section className="card-surface space-y-4 p-5">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="inv-search" className="label">Search</label>
          <input
            id="inv-search"
            className="input"
            placeholder="Card or set name…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>

        <div className="min-w-[13rem]">
          <label htmlFor="inv-sort" className="label">Sort by</label>
          <select
            id="inv-sort"
            className="input"
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <ChipRow label="Color">
        {COLORS.map((c) => {
          const on = filters.colors.includes(c.code)
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => set({ colors: toggle(filters.colors, c.code) })}
              aria-pressed={on}
              className={on ? 'chip-on' : 'chip-off'}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/30"
                style={{ backgroundColor: c.hex }}
              />
              {c.label}
            </button>
          )
        })}
      </ChipRow>

      {facets.types.length > 1 && (
        <ChipRow label="Type">
          {facets.types.map((t) => (
            <Chip
              key={t}
              on={filters.types.includes(t)}
              onClick={() => set({ types: toggle(filters.types, t) })}
            >
              {t}
            </Chip>
          ))}
        </ChipRow>
      )}

      {facets.rarities.length > 1 && (
        <ChipRow label="Rarity">
          {facets.rarities.map((r) => (
            <Chip
              key={r}
              on={filters.rarities.includes(r)}
              onClick={() => set({ rarities: toggle(filters.rarities, r) })}
            >
              <span className="capitalize">{r}</span>
            </Chip>
          ))}
        </ChipRow>
      )}

      <ChipRow label="Finish">
        {FINISHES.map((f) => (
          <Chip
            key={f.code}
            on={filters.finishes.includes(f.code)}
            onClick={() => set({ finishes: toggle(filters.finishes, f.code) })}
          >
            {f.label}
          </Chip>
        ))}
      </ChipRow>

      <ChipRow label="Condition">
        {CONDITIONS.map((c) => (
          <Chip
            key={c.code}
            on={filters.conditions.includes(c.code)}
            onClick={() => set({ conditions: toggle(filters.conditions, c.code) })}
          >
            {c.code}
          </Chip>
        ))}
      </ChipRow>

      {facets.sets.length > 1 && (
        <div>
          <label htmlFor="inv-set" className="label">Set</label>
          <select
            id="inv-set"
            className="input"
            value={filters.sets[0] ?? ''}
            onChange={(e) => set({ sets: e.target.value ? [e.target.value] : [] })}
          >
            <option value="">All sets</option>
            {facets.sets.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {isFiltered && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="btn-secondary"
        >
          Clear filters
        </button>
      )}
    </section>
  )
}

function ChipRow({ label, children }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({ on, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={on ? 'chip-on' : 'chip-off'}
    >
      {children}
    </button>
  )
}
