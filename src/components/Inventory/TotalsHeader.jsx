import { BUYLIST, formatUsd } from '../../lib/pricing.js'

const pct = (n) => `${Math.round(n * 100)}%`

/**
 * The numbers Kadyn actually cares about. Buylist figures are derived from the
 * condition-adjusted total, not raw market, because a shop grades the card.
 */
export default function TotalsHeader({ totals, filtered }) {
  return (
    <section className="card-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-bright">
          {filtered ? 'Filtered selection' : 'Whole collection'}
        </h2>
        <p className="text-xs text-ink-muted">
          {totals.cardCount} card{totals.cardCount === 1 ? '' : 's'} ·{' '}
          {totals.uniqueCount} unique
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Figure
          label="TCG market"
          value={formatUsd(totals.market)}
          hint="Near Mint prices"
        />
        <Figure
          label="Adjusted for condition"
          value={formatUsd(totals.adjusted)}
          hint="What it's really worth"
          emphasis
        />
        <Figure
          label={`Pandemonium cash`}
          value={formatUsd(totals.cash)}
          hint={`${pct(BUYLIST.cash)} by check`}
        />
        <Figure
          label="Pandemonium credit"
          value={formatUsd(totals.credit)}
          hint={`${pct(BUYLIST.credit)} store credit`}
        />
      </dl>

      {totals.unpricedRows > 0 && (
        <p className="mt-4 rounded-lg bg-surface-700 px-3 py-2 text-xs text-ink-normal">
          {totals.unpricedCards} card{totals.unpricedCards === 1 ? '' : 's'} across{' '}
          {totals.unpricedRows} row{totals.unpricedRows === 1 ? '' : 's'} have no TCG price
          and are left out of these totals.
        </p>
      )}
    </section>
  )
}

function Figure({ label, value, hint, emphasis }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd
        className={`mt-1 text-2xl font-bold tabular-nums ${
          emphasis ? 'text-accent' : 'text-ink-bright'
        }`}
      >
        {value}
      </dd>
      <p className="text-[11px] text-ink-muted">{hint}</p>
    </div>
  )
}
