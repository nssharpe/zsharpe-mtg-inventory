/**
 * Paste the firebaseConfig object from the Firebase console here.
 * See SETUP.md step 6.
 *
 * This is safe to commit to a public repo. The Firebase web config is an
 * identifier, not a credential — Google designs it to ship in client code.
 * What actually protects the data is the Firestore security rules (the email
 * allowlist) plus the authorized-domains list, both set in the console.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCiIYRQo0abQfpjp0iBHPhG5quOVYXFEAM',
  authDomain: 'zsharpe-mtg-inventory.firebaseapp.com',
  projectId: 'zsharpe-mtg-inventory',
  storageBucket: 'zsharpe-mtg-inventory.firebasestorage.app',
  messagingSenderId: '298260984070',
  appId: '1:298260984070:web:08e9350b1666d759012e87',
}

/** Only these addresses can sign in. Must match the Firestore rules exactly. */
export const ALLOWED_EMAILS = [
  'nssharpe@gmail.com',
  'kadyn.z.sharpe@gmail.com',
]

export const isConfigured = !firebaseConfig.apiKey.startsWith('PASTE')
