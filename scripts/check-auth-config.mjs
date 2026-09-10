/**
 * Verifies the Firebase API key accepts every origin the Google sign-in flow
 * actually uses.
 *
 * Why this exists: restricting the key to the site's own domain looks correct
 * and silently breaks sign-in for anyone without an existing session. The popup
 * runs on <project>.firebaseapp.com/__/auth/handler, and that page calls
 * Identity Toolkit with the same key — so the auth domain needs to be on the
 * allowlist too, even though no human ever types it.
 *
 * Referer is a forbidden header in browsers but not in Node, so this can probe
 * each origin directly.
 *
 * Run: npm run check:auth
 */
import { firebaseConfig } from '../src/firebase.config.js'

const KEY = firebaseConfig.apiKey
const AUTH_DOMAIN = firebaseConfig.authDomain
const PROJECT = firebaseConfig.projectId

const ORIGINS = [
  {
    origin: 'https://nssharpe.github.io',
    why: 'the live site',
    required: true,
  },
  {
    origin: `https://${AUTH_DOMAIN}`,
    why: 'the sign-in popup (__/auth/handler) — needed even though nobody visits it',
    required: true,
  },
  {
    origin: `https://${PROJECT}.web.app`,
    why: "Firebase's alias for the auth domain",
    required: false,
  },
  {
    origin: 'http://localhost:5173',
    why: 'local development',
    required: false,
  },
]

// An origin that must NOT work, or the restriction is doing nothing at all.
const CONTROL = 'https://example.com'

async function probe(origin) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects?key=${KEY}`,
    { headers: { Referer: `${origin}/` } },
  )
  const body = await res.json().catch(() => ({}))
  return {
    ok: res.status === 200,
    status: res.status,
    reason: body?.error?.details?.[0]?.reason ?? body?.error?.status ?? '',
  }
}

console.log(`Checking API key restrictions for ${PROJECT}\n`)

let failures = 0
for (const { origin, why, required } of ORIGINS) {
  const { ok, status, reason } = await probe(origin)
  const mark = ok ? 'PASS' : required ? 'FAIL' : 'warn'
  if (!ok && required) failures++
  console.log(`  ${mark}  ${origin}`)
  console.log(`        ${why}`)
  if (!ok) console.log(`        -> ${status} ${reason}`)
}

const control = await probe(CONTROL)
console.log(`\n  ${control.ok ? 'warn' : 'PASS'}  ${CONTROL} is blocked`)
console.log('        an unrelated site must not be able to use the key')
if (control.ok) {
  console.log('        -> NOT blocked: the key has no website restriction at all')
}

if (failures > 0) {
  console.log(
    `\n${failures} required origin(s) blocked. Sign-in will fail for anyone ` +
      `without an existing session.\n` +
      `Fix: add them under Application restrictions -> Websites at\n` +
      `https://console.cloud.google.com/apis/credentials?project=${PROJECT}\n`,
  )
  process.exit(1)
}

console.log('\nAll required origins allowed.\n')
