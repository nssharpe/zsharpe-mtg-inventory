# ZSharpe MTG Inventory — Design

**Date:** 2026-09-09
**Status:** Approved

A web app for Kadyn and Nate Sharpe to track a shared Magic: The Gathering card
collection, see what it's worth at TCGplayer prices, and see what Pandemonium
would pay for it in person.

---

## 1. Context and constraints

### TCGplayer's API is closed

The original plan called for the TCGplayer API. Their developer documentation
states they are "no longer granting new API access at this time." There is no
application path, partner tier, or waitlist.

**Resolution:** Scryfall embeds TCGplayer prices in every card object
(`prices.usd`, `prices.usd_foil`, `prices.usd_etched`), refreshed daily. This is
TCGplayer **market** price. One API therefore supplies card data, art, metadata,
*and* pricing, with no API key and no server-side secret.

### Verified empirically (2026-09-09)

- Scryfall responds to `fetch()` from a foreign browser origin — CORS is open,
  no proxy needed.
- `POST /cards/collection` accepts up to 75 identifiers per request and returns
  full card objects **with prices inline**, plus a `not_found` array. This makes
  bulk price refresh cheap.
- `prices` keys are `usd`, `usd_foil`, `usd_etched`, `eur`, `eur_foil`, `tix`.
  Any of them may be `null` (e.g. online-only printings such as Black Lotus in
  the VMA set return `usd: null`).
- `finishes` is a per-printing array of `nonfoil` / `foil` / `etched`.

### Hosting

GitHub Pages, repo `nssharpe/zsharpe-mtg-inventory`, served at
`https://nssharpe.github.io/zsharpe-mtg-inventory/`. Free-tier Pages requires a
public repo, so the **source is public**; the **inventory data is not** — it sits
behind Firebase Auth and Firestore security rules.

Because the site is served from a subpath, Vite's `base` must be set to
`/zsharpe-mtg-inventory/` or the deployed build will 404 on all assets.

---

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Ownership | One shared collection, no per-card owner | Simplest model; a single total is what they care about |
| Entry flow | Visual printing picker | Printing is where the value lives; picking it accurately matters more than raw throughput |
| Value history | Not in v1 | YAGNI; can be added later |
| Stack | React + Vite + Tailwind | Auth, filtering, sorting and a card grid outgrow a single HTML file |
| Condition | Discounts value | TCG market is a Near Mint price; played cards are worth less |
| Inventory view | Grid and table, toggleable | Grid for browsing, table for value work |
| Database | Firebase (Auth + Firestore) | Only option that runs fully client-side on static hosting |

### Why Firebase and not Turso

GitHub Pages serves static files only. Turso requires either an embedded auth
token — readable by anyone who views source — or a proxy server, which defeats
static hosting. Firebase Auth + Firestore run entirely client-side, with Google
sign-in built in and access enforced server-side by security rules.

---

## 3. Data model

Firestore, one shared collection.

```
/collection/{lineId}

  # Identity
  scryfallId       string     per-printing UUID
  oracleId         string     stable across printings; groups reprints
  finish           string     'nonfoil' | 'foil' | 'etched'
  condition        string     'NM' | 'LP' | 'MP' | 'HP' | 'DMG'
  language         string     default 'en'

  # Denormalized card data (copied at add time)
  name             string
  setCode          string
  setName          string
  collectorNumber  string
  colorIdentity    string[]   e.g. ['R']; [] means colorless
  typeLine         string
  rarity           string
  cmc              number
  imageSmall       string
  imageNormal      string

  # Mutable
  quantity         number     >= 1
  notes            string     optional

  # Price snapshot
  priceUsd         number|null   market price for THIS finish
  priceUpdatedAt   timestamp|null

  addedAt          timestamp
  updatedAt        timestamp
```

```
/meta/settings
  lastPriceRefresh  timestamp
```

### Row identity

A row is uniquely identified by **`scryfallId` + `finish` + `condition` +
`language`**. Adding a card matching an existing row increments `quantity`
rather than creating a duplicate. The document ID is a deterministic slug of
those four fields, which makes the merge a single write with no read-then-write
race.

`finish` is not a display flag: it selects which price key is read
(`usd` / `usd_foil` / `usd_etched`) and is constrained by the printing's own
`finishes` array.

### Why denormalize card data

Firestore cannot join against Scryfall. Copying name, colors, type, rarity and
image URLs into the row means the inventory view filters and sorts hundreds of
rows instantly with zero network calls. Only prices go stale, and only prices
are refreshed.

---

## 4. Access control

The email allowlist is enforced in **Firestore security rules**. The app also
checks the signed-in address, but only to show a friendly message instead of a
raw permissions error — the rules are the real gate.

```
function isAllowedUser() {
  return request.auth != null
    && request.auth.token.email_verified == true
    && request.auth.token.email in [
         'nssharpe@gmail.com',
         'kadyn.z.sharpe@gmail.com'
       ];
}
```

with a terminating `match /{document=**} { allow read, write: if false; }` so
any path not explicitly allowed is denied.

Sign-in is `signInWithPopup` with the Google provider. `nssharpe.github.io` and
`localhost` must both appear in Firebase's authorized-domains list.

The Firebase web config (`apiKey` etc.) is committed to the public repo. It is
an identifier, not a credential, and is designed to ship in client code.

---

## 5. Pricing

All constants live in a single module, `src/lib/pricing.js`, so any of them is a
one-line change.

### Finish to price key

| finish | key |
|---|---|
| `nonfoil` | `prices.usd` |
| `foil` | `prices.usd_foil` |
| `etched` | `prices.usd_etched` |

### Condition multipliers

TCG market price is a Near Mint price.

| Condition | Multiplier |
|---|---|
| NM — Near Mint | 1.00 |
| LP — Lightly Played | 0.85 |
| MP — Moderately Played | 0.70 |
| HP — Heavily Played | 0.50 |
| DMG — Damaged | 0.35 |

### Buylist multipliers

| Offer | Multiplier |
|---|---|
| Pandemonium cash (check) | 0.60 |
| Pandemonium store credit | 0.70 |

### Calculation

```
lineMarketValue       = priceUsd * quantity
lineAdjustedValue     = priceUsd * conditionMultiplier[condition] * quantity
linePandemoniumCash   = lineAdjustedValue * 0.60
linePandemoniumCredit = lineAdjustedValue * 0.70
```

Buylist percentages apply to the **condition-adjusted** value, because a shop
grades the physical card at the counter.

**Stated assumption:** these percentages are applied to TCG *market* price,
which is what Scryfall provides. If Pandemonium quotes off TCG low or mid
instead, only the multiplier constants change.

### Null prices

`priceUsd == null` (online-only printings, brand-new cards not yet priced):
the row displays an em dash, is excluded from all totals, and is counted in a
"N cards unpriced" note under the totals. Never coerced to zero silently.

---

## 6. Price refresh

1. Collect distinct `scryfallId`s from the inventory.
2. Chunk into groups of 75.
3. `POST https://api.scryfall.com/cards/collection` per chunk, ~100ms apart
   (Scryfall asks for 50–100ms between requests).
4. Map each returned card back to rows by `scryfallId`, read the price key for
   each row's `finish`, write `priceUsd` and `priceUpdatedAt`.
5. Write back with Firestore batched writes, 500 operations per batch.

Triggered by a manual **Refresh prices** button, and automatically on load when
`meta/settings.lastPriceRefresh` is more than 24 hours old. Shows progress.

IDs appearing in `not_found` leave their rows' existing price untouched and are
surfaced as a warning rather than crashing the refresh.

---

## 7. Screens

### Sign in
Single Google button. If the signed-in address is not on the allowlist, sign out
and show a plain explanatory message.

### Add cards
1. Name field, debounced against `GET /cards/autocomplete?q=`.
2. Choosing a name loads every printing:
   `GET /cards/search?q=!"<name>"&unique=prints&order=released&dir=desc`.
3. Printings render as an art grid — set name, set code, collector number,
   release year, and market price on each.
4. Selecting a printing opens a panel: finish (only the finishes that printing
   supports), condition, quantity.
5. **Add** writes the row.
6. A "recently added" strip below shows the last several additions with an undo,
   so a misclick is obvious and cheap to reverse.

### Inventory
Grid/table toggle over one shared filter and sort state.

- **Filters:** color identity (W/U/B/R/G/colorless, multi-select), card type,
  rarity, set, finish, condition, name search.
- **Sorts:** adjusted value (default, descending), name, mana value, rarity,
  set, date added, quantity.
- **Totals header:** total cards, unique printings, TCG market total,
  condition-adjusted total, Pandemonium cash, Pandemonium credit, and the
  unpriced-card count.

### Card detail
Full art, all price variants for the printing, edit quantity / condition /
finish, delete row, link to the card on Scryfall and TCGplayer.

---

## 8. Error handling

| Condition | Behaviour |
|---|---|
| Scryfall unreachable or rate-limited | Keep showing cached data; banner reading "prices last updated {relative time}" |
| Card in `not_found` on refresh | Keep prior price, flag the row, warn once |
| `priceUsd` null | Show em dash, exclude from totals, count in unpriced note |
| Offline | Firestore offline persistence serves reads; writes queue and flush on reconnect |
| Non-allowlisted Google account | Sign out immediately, explain plainly |
| Firestore permission denied | Treated as a bug, surfaced clearly, not swallowed |

---

## 9. Testing

Vitest over the pure logic where a silent error would corrupt reported value:

- price selection by finish, including null handling
- condition multiplier arithmetic and rounding
- Pandemonium cash/credit derivation
- collection totals with a mix of priced and unpriced rows
- deterministic row-ID generation and the add-merges-into-existing-row path
- filter and sort predicates
- chunking into groups of 75

Manual smoke checklist covers Google sign-in, the allowlist rejection path, and
a deployed-build asset load on the Pages subpath.

---

## 10. Module layout

```
src/
  lib/
    firebase.js      init, auth, db handles
    pricing.js       all multipliers + value calculations   (pure)
    scryfall.js      autocomplete, printings, batch collection fetch
    inventory.js     row ID, add/merge, update, delete
    filters.js       filter + sort predicates                (pure)
  components/
    SignIn.jsx
    AddCard/         SearchBox, PrintingGrid, AddPanel, RecentlyAdded
    Inventory/       Toolbar, Filters, TotalsHeader, CardGrid, CardTable
    CardDetail.jsx
  App.jsx
```

`pricing.js` and `filters.js` are pure and carry the test suite. `scryfall.js`
is the only module that talks to Scryfall; `inventory.js` is the only one that
writes Firestore.

---

## 11. Out of scope for v1

Value history charts, sealed product, deck building, non-English printings
beyond a language field, card scanning by camera, CSV export, public sharing.
