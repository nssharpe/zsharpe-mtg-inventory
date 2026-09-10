import { useCallback, useEffect, useRef, useState } from 'react'
import { isConfigured, signOut, watchAuth } from './lib/firebase.js'
import {
  getLastRefresh,
  importSeed,
  watchInventory,
  writeRefreshedPrices,
} from './lib/inventory.js'
import seedRows from './data/kadyn-sheet-seed.json'
import { fetchCardsByIds } from './lib/scryfall.js'
import { NOTE_FADE_MS, isTransient, refreshSummary } from './lib/refreshNote.js'
import SignIn from './components/SignIn.jsx'
import Inventory from './components/Inventory/Inventory.jsx'
import AddCard from './components/AddCard/AddCard.jsx'
import CardDetail from './components/CardDetail.jsx'

const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = still checking
  const [rows, setRows] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [tab, setTab] = useState('inventory')
  // { row, mode } — mode lets the inventory's "+ copy" open the dialog
  // straight into the duplicate panel.
  const [openRow, setOpenRow] = useState(null)
  const [refresh, setRefresh] = useState({ busy: false, done: 0, total: 0 })
  const [lastRefresh, setLastRefresh] = useState(null)
  // { text, tone }. 'info' fades on its own; 'error' stays until the next run.
  const [refreshNote, setRefreshNote] = useState(null)

  const autoRefreshed = useRef(false)
  const [importState, setImportState] = useState({ busy: false, note: null, phase: '' })

  // The sheet import is a one-time job; hide the offer once its rows are here.
  const alreadyImported = rows.some((r) => r.sourceLabel)

  async function runImport() {
    const ok = window.confirm(
      [
        `Import ${seedRows.length} cards from Kadyn's spreadsheet?`,
        "The set is a guess for most of them - they'll be flagged for review, " +
          'sorted by how much the guess could be wrong.',
        'Running this twice is safe; it overwrites rather than duplicating.',
      ].join('\n\n'),
    )
    if (!ok) return

    setImportState({ busy: true, note: null, phase: 'starting' })
    try {
      const { written, missing, notFound } = await importSeed(seedRows, (p) =>
        setImportState({
          busy: true,
          note: null,
          phase: p.phase === 'fetching'
            ? `Looking up cards ${p.done}/${p.total}`
            : `Saving ${p.done}/${p.total}`,
        }),
      )
      const problems = [...missing, ...notFound]
      setImportState({
        busy: false,
        phase: '',
        note:
          `Imported ${written} cards.` +
          (problems.length ? ` ${problems.length} couldn't be looked up.` : ''),
      })
    } catch (err) {
      setImportState({ busy: false, phase: '', note: `Import failed: ${err.message}` })
    }
  }

  useEffect(() => {
    if (!isConfigured) return undefined
    return watchAuth(setUser)
  }, [])

  useEffect(() => {
    if (!user) {
      setRows([])
      return undefined
    }
    return watchInventory(
      (next) => {
        setRows(next)
        setLoadError(null)
      },
      (err) => setLoadError(describeFirestoreError(err)),
    )
  }, [user])

  useEffect(() => {
    if (!user) return
    getLastRefresh().then(setLastRefresh).catch(() => {})
  }, [user])

  const runRefresh = useCallback(
    async (rowsToPrice) => {
      if (rowsToPrice.length === 0) return
      setRefresh({ busy: true, done: 0, total: rowsToPrice.length })
      setRefreshNote(null)
      try {
        const ids = rowsToPrice.map((r) => r.scryfallId)
        const { found, notFound } = await fetchCardsByIds(ids, ({ done, total }) =>
          setRefresh({ busy: true, done, total }),
        )
        const changed = await writeRefreshedPrices(rowsToPrice, found)
        setLastRefresh(new Date())

        setRefreshNote(refreshSummary({ changed, notFound: notFound.length }))
      } catch (err) {
        setRefreshNote(refreshSummary({ error: err.message }))
      } finally {
        setRefresh({ busy: false, done: 0, total: 0 })
      }
    },
    [],
  )

  // A confirmation is transient; let it fade back to the "last updated" line
  // rather than sitting in the header for the rest of the session.
  useEffect(() => {
    if (!isTransient(refreshNote)) return undefined
    const timer = setTimeout(() => setRefreshNote(null), NOTE_FADE_MS)
    return () => clearTimeout(timer)
  }, [refreshNote])

  // Refresh once on load if the last refresh is over a day old.
  useEffect(() => {
    if (!user || autoRefreshed.current || rows.length === 0) return
    const age = lastRefresh ? Date.now() - toDate(lastRefresh).getTime() : Infinity
    if (age > STALE_AFTER_MS) {
      autoRefreshed.current = true
      runRefresh(rows)
    }
  }, [user, rows, lastRefresh, runRefresh])

  if (!isConfigured) return <NotConfigured />
  if (user === undefined) return <Splash>Loading…</Splash>
  if (!user) return <SignIn />

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-surface-600 bg-surface-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="text-base font-bold text-ink-bright">
            <span aria-hidden="true">🃏</span> ZSharpe MTG Inventory
          </h1>

          <nav className="flex gap-1 rounded-lg bg-surface-800 p-1" aria-label="Sections">
            <TabButton active={tab === 'inventory'} onClick={() => setTab('inventory')}>
              Inventory
            </TabButton>
            <TabButton active={tab === 'add'} onClick={() => setTab('add')}>
              Add cards
            </TabButton>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => runRefresh(rows)}
              disabled={refresh.busy || rows.length === 0}
              className="btn-secondary"
            >
              {refresh.busy
                ? `Refreshing ${refresh.done}/${refresh.total}…`
                : 'Refresh prices'}
            </button>
            <span className="hidden text-xs text-ink-muted sm:inline">
              {user.email}
            </span>
            <button type="button" onClick={signOut} className="btn-ghost">
              Sign out
            </button>
          </div>
        </div>

        {(lastRefresh || refreshNote) && (
          <div
            className={`mx-auto max-w-7xl px-4 pb-2 text-xs ${
              refreshNote?.tone === 'error' ? 'text-amber-300' : 'text-ink-muted'
            }`}
          >
            {refreshNote?.text ??
              `Prices last updated ${relativeTime(toDate(lastRefresh))}.`}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl p-4">
        {loadError && (
          <p role="alert" className="mb-4 rounded-lg border border-red-800 bg-red-950
                                      px-3 py-2 text-sm text-red-200">
            {loadError}
          </p>
        )}

        {tab === 'inventory' && !alreadyImported && (
          <section className="mb-5 rounded-xl border border-surface-600 bg-surface-800 p-4">
            <h2 className="text-sm font-semibold text-ink-bright">
              Import Kadyn's spreadsheet
            </h2>
            <p className="mt-1 text-sm text-ink-normal">
              {seedRows.length} cards from the Google Sheet, matched against Scryfall.
              The sheet only had names, so the printing is a best guess (most recent)
              for most of them — every guessed row gets flagged for review, ordered by
              how many dollars ride on the answer.
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              Worth adding one card by hand first to check writing works. Re-running
              this is safe — it overwrites rather than duplicating.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runImport}
                disabled={importState.busy}
                className="btn-primary"
              >
                {importState.busy ? importState.phase || 'Importing…' : 'Import the sheet'}
              </button>
              {importState.note && (
                <span className="text-sm text-ink-normal">{importState.note}</span>
              )}
            </div>
          </section>
        )}

        {tab === 'inventory' ? (
          <Inventory
            rows={rows}
            onOpen={(row) => setOpenRow({ row, mode: 'view' })}
            onDuplicate={(row) => setOpenRow({ row, mode: 'duplicate' })}
          />
        ) : (
          <AddCard />
        )}
      </main>

      {openRow && (
        <CardDetail
          // Re-read from the live rows so the panel reflects other-tab edits.
          row={rows.find((r) => r.id === openRow.row.id) ?? openRow.row}
          initialMode={openRow.mode}
          onClose={() => setOpenRow(null)}
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-accent text-surface-900' : 'text-ink-muted hover:text-ink-bright'
      }`}
    >
      {children}
    </button>
  )
}

function Splash({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-ink-muted">
      {children}
    </div>
  )
}

function NotConfigured() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card-surface max-w-lg p-8">
        <h1 className="text-xl font-bold text-ink-bright">Firebase isn't configured yet</h1>
        <p className="mt-3 text-sm text-ink-normal">
          Follow <code className="rounded bg-surface-900 px-1.5 py-0.5 text-accent">SETUP.md</code>,
          then paste the <code className="rounded bg-surface-900 px-1.5 py-0.5 text-accent">firebaseConfig</code>{' '}
          object into{' '}
          <code className="rounded bg-surface-900 px-1.5 py-0.5 text-accent">
            src/firebase.config.js
          </code>.
        </p>
      </div>
    </div>
  )
}

/** Firestore timestamps, Dates and nulls all arrive here. */
function toDate(value) {
  if (!value) return new Date(0)
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  return new Date(value)
}

function relativeTime(date) {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 90) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  if (hours < 36) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  return `${Math.round(hours / 24)} days ago`
}

function describeFirestoreError(err) {
  if (err?.code === 'permission-denied') {
    return (
      "Firestore denied the read. Check the security rules in the Firebase console " +
      'include this account in the email allowlist.'
    )
  }
  return err?.message || 'Could not load the collection.'
}
