import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CrazyGamesStrategy } from '@/utils/save/CrazyGamesStrategy'
import { SaveManager } from '@/utils/save/SaveManager'

// Fake CrazyGames `data` module — keeps an in-memory map so we can assert
// on what got mirrored. The real SDK API is a subset we can fully cover
// here (`getItem` / `setItem` / `removeItem`).
const makeFakeData = (seed: Record<string, string> = {}) => {
  const store = new Map<string, string>(Object.entries(seed))
  return {
    store,
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key)
    })
  }
}

const MANIFEST_KEY = '__save_internal__crazy_keys'

describe('CrazyGamesStrategy (isCrazyWeb guard)', () => {
  beforeEach(() => {
    // setup.ts's beforeEach installed a fresh in-memory localStorage.
    vi.useFakeTimers()
  })
  afterEach(() => {
    // Drop any still-pending fake timers before restoring real ones —
    // otherwise scheduled mirror flushes can fire after the test's fake
    // SDK has gone out of scope.
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('hydrates localStorage from the SDK manifest at boot', async () => {
    const data = makeFakeData({
      [MANIFEST_KEY]: JSON.stringify(['coins', 'team']),
      coins: '150',
      team: '[1,2,3]'
    })
    const manager = new SaveManager(new CrazyGamesStrategy(() => data))
    await manager.init()

    expect(window.localStorage.getItem('coins')).toBe('150')
    expect(window.localStorage.getItem('team')).toBe('[1,2,3]')
  })

  it('mirrors subsequent writes to the SDK after a debounce', async () => {
    const data = makeFakeData()
    const manager = new SaveManager(new CrazyGamesStrategy(() => data))
    await manager.init()

    window.localStorage.setItem('coins', '10')
    window.localStorage.setItem('coins', '20')
    window.localStorage.setItem('team', '[9]')

    // No immediate calls — writes are batched.
    expect(data.setItem).not.toHaveBeenCalled()

    await vi.runAllTimersAsync()

    // One call per final key value + one for the manifest.
    const writes = data.setItem.mock.calls.filter(c => c[0] !== MANIFEST_KEY)
    expect(writes).toContainEqual(['coins', '20'])
    expect(writes).toContainEqual(['team', '[9]'])
    expect(JSON.parse(data.store.get(MANIFEST_KEY)!)).toEqual(
      expect.arrayContaining(['coins', 'team'])
    )
  })

  it('mirrors removeItem to the SDK and drops the key from the manifest', async () => {
    const data = makeFakeData({
      [MANIFEST_KEY]: JSON.stringify(['coins']),
      coins: '5'
    })
    const manager = new SaveManager(new CrazyGamesStrategy(() => data))
    await manager.init()

    window.localStorage.removeItem('coins')
    await vi.runAllTimersAsync()

    expect(data.removeItem).toHaveBeenCalledWith('coins')
    expect(JSON.parse(data.store.get(MANIFEST_KEY)!)).not.toContain('coins')
  })

  it('no-ops gracefully when the SDK is unavailable', async () => {
    const manager = new SaveManager(new CrazyGamesStrategy(() => null))
    await manager.init()

    // Writes shouldn't throw even with no backend.
    expect(() => window.localStorage.setItem('k', 'v')).not.toThrow()
    await vi.runAllTimersAsync()
    expect(window.localStorage.getItem('k')).toBe('v')
  })

  it('flush() pushes pending writes synchronously on demand', async () => {
    const data = makeFakeData()
    const manager = new SaveManager(new CrazyGamesStrategy(() => data))
    await manager.init()

    window.localStorage.setItem('coins', '1')
    expect(data.setItem).not.toHaveBeenCalled()

    await manager.flush()

    expect(data.setItem).toHaveBeenCalledWith('coins', '1')
  })

  it('does not mirror hydration writes back to the SDK', async () => {
    const data = makeFakeData({
      [MANIFEST_KEY]: JSON.stringify(['coins']),
      coins: '150'
    })
    const manager = new SaveManager(new CrazyGamesStrategy(() => data))
    await manager.init()

    // No writes should have been issued to the SDK during hydrate.
    expect(data.setItem).not.toHaveBeenCalled()
  })
})
