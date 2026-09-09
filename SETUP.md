# Setup — Firebase Auth + Firestore

You need to do these steps; they create the project and produce a config block for me.
Total time: ~10 minutes. Everything here is on Firebase's free (Spark) plan — no billing card needed.

---

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com/> and sign in as **nssharpe@gmail.com**.
2. Click **Create a project** (or **Add project**).
3. Project name: `zsharpe-mtg-inventory`
   - Firebase will show a generated project ID underneath, like `zsharpe-mtg-inventory-a1b2c`. That's fine, note it down.
4. **Turn OFF Google Analytics.** We don't need it and it adds a consent step. Toggle it off, click **Create project**.
5. Wait for provisioning, then **Continue**.

---

## 2. Enable Google sign-in

1. In the left sidebar: **Build → Authentication**.
2. Click **Get started**.
3. On the **Sign-in method** tab, click **Google** in the provider list.
4. Toggle **Enable** on.
5. Set **Public-facing name for project** to `ZSharpe MTG Inventory`.
6. Set **Support email for project** to `nssharpe@gmail.com`.
7. Click **Save**.

You do NOT need to touch the Google Cloud OAuth consent screen. Firebase configures the
OAuth client for you when you enable the Google provider.

---

## 3. Authorize the GitHub Pages domain

This is the step that, if skipped, makes sign-in fail silently on the live site.

1. Still in **Authentication**, go to the **Settings** tab.
2. Open **Authorized domains**.
3. `localhost` should already be listed — leave it (I need it for local development).
4. Click **Add domain** and enter exactly:

   ```
   nssharpe.github.io
   ```

   Domain only. No `https://`, no `/zsharpe-mtg-inventory` path.
5. Click **Add**.

---

## 4. Create the Firestore database

1. Left sidebar: **Build → Firestore Database**.
2. Click **Create database**.
3. Database ID: leave as `(default)`.
4. Location: choose **`nam5 (United States)`** (or `us-central1` if offered instead).
   **This cannot be changed later.**
5. Choose **Start in production mode** (locked down — we replace the rules in the next step).
6. Click **Create** / **Enable**.

---

## 5. Paste in the security rules

This is what actually restricts the collection to the two of you. Everything else is cosmetic.

1. In **Firestore Database**, open the **Rules** tab.
2. Select all the existing text and replace it with exactly this:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAllowedUser() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email in [
             'nssharpe@gmail.com',
             'kadyn.z.sharpe@gmail.com'
           ];
    }

    match /collection/{lineId} {
      allow read, write: if isAllowedUser();
    }

    match /meta/{docId} {
      allow read, write: if isAllowedUser();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. Click **Publish**.

The site itself will be publicly loadable (GitHub Pages on a free account requires a public
repo), but with these rules nobody outside those two addresses can read or write a single
row of inventory.

---

## 6. Register the web app and grab the config

1. Click the **gear icon** (top left, next to "Project Overview") → **Project settings**.
2. Scroll to **Your apps** at the bottom of the **General** tab.
3. Click the **web icon** — `</>`.
4. App nickname: `MTG Inventory`
5. **Leave "Also set up Firebase Hosting" UNCHECKED.** We're deploying to GitHub Pages.
6. Click **Register app**.
7. Firebase shows a code snippet containing a `firebaseConfig` object. **Copy the whole
   object** and paste it back to me. It looks like this:

```js
const firebaseConfig = {
  apiKey: "AIzaSy........................",
  authDomain: "zsharpe-mtg-inventory-a1b2c.firebaseapp.com",
  projectId: "zsharpe-mtg-inventory-a1b2c",
  storageBucket: "zsharpe-mtg-inventory-a1b2c.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};
```

8. Click **Continue to console**. (Skip the npm install instructions — I handle that.)

---

## Is it safe to commit that config?

**Yes.** The Firebase web config is an *identifier*, not a credential — it's designed to ship
in public client-side code, and Google's own docs say so. `apiKey` here is not a secret key;
it only routes requests to your project. Anyone who finds it still hits the security rules
from step 5 and gets nothing.

The two things that actually protect the data are:
- the **security rules** (step 5) — the email allowlist
- the **authorized domains** (step 3) — sign-in only works from your domains

---

## 7. Add Kadyn

Nothing to do here. There's no "invite" step — the rules key off email address, so the first
time Kadyn signs in with **kadyn.z.sharpe@gmail.com** he's in automatically.

---

## 7b. Restrict the API key (and the GitHub alert you'll get)

Pushing the config trips GitHub's secret scanner with a **"Google API Key"**
alert. That is expected: the scanner matches the `AIza...` prefix and cannot
tell a Firebase *web* key from a server-side Google Cloud key. Firebase web keys
ship in the client bundle of every Firebase web app by design.

It does not expose the collection — the security rules from step 5 deny reads and
writes to anyone outside the email allowlist, signed in or not. The one real gap
is that the key lets anyone call this project's Firebase Auth endpoints and burn
quota. Closing it takes two minutes.

### You don't need to create a Cloud project

**Every Firebase project *is* a Google Cloud project.** Creating
`zsharpe-mtg-inventory` in the Firebase console created the matching Cloud
project automatically — there is nothing to set up. It just won't appear under
**Recent** in the Cloud console's project picker, because you've never opened it
there. (If you land in `bank-of-sharpe` or another project, that's the picker
defaulting to whatever you used last.)

### Steps

1. Open this link, which pins the right project and skips the picker entirely:

   <https://console.cloud.google.com/apis/credentials?project=zsharpe-mtg-inventory>

   If you ever need the picker instead, click the project dropdown and use the
   **All** tab — not **Recent** — then search `zsharpe-mtg-inventory`.

2. Under **API Keys** you'll see one key, most likely named
   **Browser key (auto created by Firebase)**. Click its name.
   (Firebase sometimes names it *Web API Key* instead — if there's only one key,
   that's the one.)

3. Under **Application restrictions**, choose **Websites**, then **Add**:

   ```
   https://nssharpe.github.io/*
   ```
   ```
   http://localhost:5173/*
   ```

4. Leave **API restrictions** on **Don't restrict key**. Restricting APIs here
   breaks Google sign-in unless Identity Toolkit API and Token Service API are
   both explicitly allowed — the website restriction above is what actually
   limits the key.

5. **Save.** Changes take up to five minutes. Afterwards, load the live site and
   sign in once to confirm nothing broke.

Then dismiss the GitHub alert (repo **Security -> Secret scanning**) as
**Won't fix**, noting it's a public-by-design Firebase web config restricted to
the project's domains.

---

## 8. Turn on GitHub Pages

**Already done** — the repo is created and Pages is set to build from GitHub
Actions. Recorded here in case it ever needs redoing: repo **Settings -> Pages**,
then **Build and deployment -> Source -> GitHub Actions**. Without it the deploy
workflow runs green and publishes nothing.

The site is live at <https://nssharpe.github.io/zsharpe-mtg-inventory/> and
redeploys on every push to `main`.

---

## What to send me

Just the `firebaseConfig` object from step 6. If anything above looked different from what
you actually saw in the console, tell me what you saw — Firebase moves things around.
