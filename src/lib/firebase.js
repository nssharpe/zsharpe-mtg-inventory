/**
 * Firebase initialisation, auth, and the one place that knows the app is
 * unconfigured. Everything else can assume `db` and `auth` are ready.
 */

import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

import { ALLOWED_EMAILS, firebaseConfig, isConfigured } from '../firebase.config.js'

export { ALLOWED_EMAILS, isConfigured }

let app = null
let auth = null
let db = null

if (isConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  // Offline cache so the collection still renders on a flaky connection and
  // writes queue until it comes back.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
}

export { auth, db }

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

export function isAllowed(user) {
  return Boolean(
    user?.email && ALLOWED_EMAILS.includes(user.email.toLowerCase()),
  )
}

export async function signIn() {
  const result = await signInWithPopup(auth, provider)
  // The security rules are the real gate; this just turns a would-be
  // permission-denied wall into a readable message.
  if (!isAllowed(result.user)) {
    await fbSignOut(auth)
    const error = new Error('not-allowed')
    error.email = result.user?.email ?? ''
    throw error
  }
  return result.user
}

export function signOut() {
  return fbSignOut(auth)
}

export function watchAuth(callback) {
  if (!auth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}
