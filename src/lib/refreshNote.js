/**
 * Wording for the line under the header after a price refresh.
 *
 * Split out from App so the branching is testable: a confirmation is transient
 * and fades back to "prices last updated ...", but anything the user might need
 * to act on stays put.
 */

export const NOTE_FADE_MS = 6000

/** Notes that fade on their own. Errors and warnings are not among them. */
export function isTransient(note) {
  return note?.tone === 'info'
}

export function refreshSummary({ changed = 0, notFound = 0, error = null } = {}) {
  if (error) {
    return {
      text: `Couldn't refresh prices: ${error}. Showing the last known values.`,
      tone: 'error',
    }
  }

  const summary =
    changed === 0
      ? 'Prices were already up to date.'
      : `Updated ${changed} price${changed === 1 ? '' : 's'}.`

  if (notFound > 0) {
    return {
      // A printing Scryfall can't find is worth reading, so it doesn't fade.
      text:
        `${summary} ${notFound} printing${notFound === 1 ? '' : 's'} not found ` +
        `on Scryfall — those prices were left alone.`,
      tone: 'error',
    }
  }

  return { text: summary, tone: 'info' }
}
