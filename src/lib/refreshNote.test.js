import { describe, it, expect } from 'vitest'
import { NOTE_FADE_MS, isTransient, refreshSummary } from './refreshNote.js'

describe('refreshSummary', () => {
  it('confirms a normal refresh and lets it fade', () => {
    const note = refreshSummary({ changed: 12 })
    expect(note.text).toBe('Updated 12 prices.')
    expect(note.tone).toBe('info')
    expect(isTransient(note)).toBe(true)
  })

  it('says nothing changed rather than "Updated 0 prices"', () => {
    // This was the wording sitting permanently in the header.
    const note = refreshSummary({ changed: 0 })
    expect(note.text).toBe('Prices were already up to date.')
    expect(isTransient(note)).toBe(true)
  })

  it('uses the singular for one price', () => {
    expect(refreshSummary({ changed: 1 }).text).toBe('Updated 1 price.')
  })

  it('keeps a missing-printing warning on screen', () => {
    const note = refreshSummary({ changed: 5, notFound: 2 })
    expect(note.text).toContain('Updated 5 prices.')
    expect(note.text).toContain('2 printings not found')
    expect(note.tone).toBe('error')
    expect(isTransient(note)).toBe(false)
  })

  it('uses the singular for one missing printing', () => {
    expect(refreshSummary({ changed: 0, notFound: 1 }).text).toContain(
      '1 printing not found',
    )
  })

  it('reports a failure and keeps it on screen', () => {
    const note = refreshSummary({ error: 'network down' })
    expect(note.text).toContain('network down')
    expect(note.text).toContain('last known values')
    expect(note.tone).toBe('error')
    expect(isTransient(note)).toBe(false)
  })

  it('lets an error win over a change count', () => {
    expect(refreshSummary({ changed: 9, error: 'boom' }).tone).toBe('error')
  })

  it('handles being called with nothing', () => {
    expect(refreshSummary().tone).toBe('info')
  })
})

describe('isTransient', () => {
  it('is false for no note at all', () => {
    expect(isTransient(null)).toBe(false)
    expect(isTransient(undefined)).toBe(false)
  })

  it('fades after a readable pause, not instantly', () => {
    expect(NOTE_FADE_MS).toBeGreaterThanOrEqual(4000)
  })
})
