# ZSharpe MTG Inventory

Shared Magic: The Gathering collection tracker for Kadyn and Nate. Card data and
art from Scryfall, TCGplayer prices, condition-adjusted valuation, and what
Pandemonium would pay in person.

Live at <https://nssharpe.github.io/zsharpe-mtg-inventory/>

## Getting started

```bash
npm install
npm run dev
```

Then follow [SETUP.md](SETUP.md) and paste the Firebase config into
`src/firebase.config.js`. Until you do, the app shows a "not configured" screen.

`npm run dev` also serves `/zsharpe-mtg-inventory/preview.html`, a harness that
renders the inventory against fixed sample data with no Firebase — useful for
working on layout without signing in.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on :5173 |
| `npm test` | Vitest over the pure logic |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

## How pricing works

TCGplayer closed its API to new developers, so prices come from Scryfall, which
republishes TCGplayer **market** prices daily. Market price is a Near Mint price.

Everything is derived in [`src/lib/pricing.js`](src/lib/pricing.js), which is the
only file to edit if any of these change:

- **Finish** picks the price key — `usd`, `usd_foil` or `usd_etched`.
- **Condition** discounts it — NM 100%, LP 85%, MP 70%, HP 50%, DMG 35%.
- **Pandemonium** pays 60% cash / 70% store credit of the condition-adjusted
  value, since a shop grades the physical card.

Cards with no USD price show an em dash, stay out of every total, and are
counted in a note under the totals — never valued at zero.

## Architecture

No backend. The app is a static bundle that talks to two services directly.

```
src/
  lib/
    firebase.js    init, Google auth, allowlist check
    pricing.js     multipliers and value math          (pure, tested)
    rows.js        Scryfall card -> inventory row      (pure, tested)
    filters.js     filter and sort predicates          (pure, tested)
    scryfall.js    the only module that calls Scryfall
    inventory.js   the only module that writes Firestore
  components/
    SignIn.jsx
    AddCard/       search, printing picker, add panel, undo
    Inventory/     totals, filters, grid and table views
    CardDetail.jsx
```

A row is one printing, in one finish, in one condition, in one language. Its
Firestore document id is derived from exactly those four fields, so adding a
card you already own merges into the existing row instead of duplicating it.

Card metadata (name, colors, type, rarity, images) is denormalized onto each row
because Firestore cannot join against Scryfall — that's what lets filtering and
sorting run with zero network calls. Only prices are refreshed, in batches of 75
through Scryfall's `/cards/collection` endpoint.

## Access

Two Google accounts are allowed. The allowlist is enforced by the Firestore
security rules in [`firestore.rules`](firestore.rules) — that file is the source
of truth and must match what's published in the Firebase console. The check in
the app only exists to show a readable message instead of a permissions error.

The repo is public (free GitHub Pages requires it) and the Firebase web config is
committed. That config is an identifier, not a credential; it's designed to ship
in client code. The rules and the authorized-domain list are what protect the data.

## Deployment

Pushing to `main` runs tests and deploys to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

`vite.config.js` sets `base: '/zsharpe-mtg-inventory/'`. If the repo is ever
renamed, that has to change too or the deployed build 404s on every asset.
