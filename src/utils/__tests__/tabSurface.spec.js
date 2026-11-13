import { describe, expect, it } from 'vitest'
import appSource from '../../App.vue?raw'
import { tabViewDefinitions } from '../tabViews.js'

/**
 * Tabs still painted with the dark shell palette. Every entry is a migration
 * TODO against the A′ plan (purple frame + light content surface): convert the
 * page to `--surface-bg`, then drop its `darkSurface` flag and this list entry.
 */
const DARK_SURFACE_TABS = [
  'shenwan-index',
  'limit-up-ladder',
  'strategy-pool',
]

describe('tab surface contract', () => {
  it('marks exactly the unmigrated dark tabs', () => {
    const marked = tabViewDefinitions.filter((tab) => tab.darkSurface).map((tab) => tab.id)
    expect(new Set(marked)).toEqual(new Set(DARK_SURFACE_TABS))
  })

  it('keeps the content canvas owned by the shell', () => {
    expect(appSource).toMatch(/\.tab-page\s*\{[\s\S]*?background:\s*var\(--surface-bg\)/)
    expect(appSource).toMatch(/\.tab-page--dark\s*\{[\s\S]*?background:\s*var\(--canvas-bg-start\)/)
  })
})
