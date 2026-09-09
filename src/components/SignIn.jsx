import { useState } from 'react'
import { ALLOWED_EMAILS, signIn } from '../lib/firebase.js'

export default function SignIn() {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSignIn() {
    setBusy(true)
    setError(null)
    try {
      await signIn()
    } catch (err) {
      if (err.message === 'not-allowed') {
        setError(
          `${err.email} isn't on the list for this collection. ` +
            `Sign in with one of: ${ALLOWED_EMAILS.join(' or ')}.`,
        )
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError(null)
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(
          'This domain is not authorized in Firebase. Add it under ' +
            'Authentication → Settings → Authorized domains.',
        )
      } else {
        setError(err.message || 'Sign-in failed. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card-surface w-full max-w-md p-8 text-center">
        <div className="text-4xl mb-3" aria-hidden="true">🃏</div>
        <h1 className="text-2xl font-bold text-ink-bright">ZSharpe MTG Inventory</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Track the collection, see what it's worth.
        </p>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="btn-primary w-full mt-6"
        >
          {busy ? 'Signing in…' : 'Sign in with Google'}
        </button>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-950 border border-red-800 px-3 py-2
                       text-sm text-red-200 text-left"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
