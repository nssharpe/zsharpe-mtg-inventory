import { formatUsd, lineAdjustedValue, lineMarketValue } from '../../lib/pricing.js'

const RARITY_STYLE = {
  common: 'bg-surface-600 text-ink-bright',
  uncommon: 'bg-slate-400 text-slate-950',
  rare: 'bg-amber-300 text-amber-950',
  mythic: 'bg-orange-500 text-orange-950',
  special: 'bg-purple-400 text-purple-950',
  bonus: 'bg-purple-400 text-purple-950',
}

function RarityBadge({ rarity }) {
  if (!rarity) return null
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase
                  ${RARITY_STYLE[rarity] ?? RARITY_STYLE.common}`}
    >
      {rarity.slice(0, 1)}
    </span>
  )
}

/** Visual browsing view. */
export function CardGrid({ rows, onOpen }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
      {rows.map((row) => {
        const value = lineAdjustedValue(row)
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onOpen(row)}
              className="group w-full overflow-hidden rounded-xl border border-surface-600
                         text-left transition hover:border-accent"
            >
              <div className="relative">
                {row.imageNormal ? (
                  <img
                    src={row.imageNormal}
                    alt={row.name}
                    loading="lazy"
                    className="aspect-[488/680] w-full object-cover"
                  />
                ) : (
                  <div className="aspect-[488/680] w-full bg-surface-700" />
                )}
                {row.quantity > 1 && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-surface-900/90
                                   px-2 py-0.5 text-xs font-bold text-ink-bright">
                    ×{row.quantity}
                  </span>
                )}
                {row.finish !== 'nonfoil' && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-accent px-1.5
                                   py-0.5 text-[10px] font-bold uppercase text-surface-900">
                    {row.finish}
                  </span>
                )}
              </div>
              <div className="bg-surface-800 p-2">
                <p className="truncate text-xs font-semibold text-ink-bright">{row.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                  {row.setCode?.toUpperCase()} · {row.condition}
                </p>
                <p className="mt-1 text-sm font-bold text-accent tabular-nums">
                  {formatUsd(value)}
                </p>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Dense view for working through the collection by value. */
export function CardTable({ rows, onOpen }) {
  return (
    <div className="card-surface overflow-x-auto">
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="border-b border-surface-600 text-left text-xs uppercase
                         tracking-wide text-ink-muted">
            <Th className="w-10" />
            <Th>Card</Th>
            <Th>Set</Th>
            <Th>Finish</Th>
            <Th>Cond</Th>
            <Th className="text-right">Qty</Th>
            <Th className="text-right">Each</Th>
            <Th className="text-right">Market</Th>
            <Th className="text-right">Adjusted</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onOpen(row)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpen(row)
                }
              }}
              className="cursor-pointer border-b border-surface-700 last:border-0
                         hover:bg-surface-700"
            >
              <td className="p-2">
                {row.imageSmall && (
                  <img
                    src={row.imageSmall}
                    alt=""
                    loading="lazy"
                    className="h-11 w-8 rounded object-cover"
                  />
                )}
              </td>
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-bright">{row.name}</span>
                  <RarityBadge rarity={row.rarity} />
                </div>
                <span className="text-xs text-ink-muted">{row.typeLine}</span>
              </td>
              <td className="p-2 text-ink-normal">
                {row.setName}
                <span className="block text-xs text-ink-muted">#{row.collectorNumber}</span>
              </td>
              <td className="p-2 text-ink-normal capitalize">{row.finish}</td>
              <td className="p-2 text-ink-normal">{row.condition}</td>
              <td className="p-2 text-right text-ink-normal tabular-nums">{row.quantity}</td>
              <td className="p-2 text-right text-ink-normal tabular-nums">
                {formatUsd(row.priceUsd)}
              </td>
              <td className="p-2 text-right text-ink-normal tabular-nums">
                {formatUsd(lineMarketValue(row))}
              </td>
              <td className="p-2 text-right font-semibold text-accent tabular-nums">
                {formatUsd(lineAdjustedValue(row))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, className = '' }) {
  return <th scope="col" className={`p-2 font-semibold ${className}`}>{children}</th>
}
