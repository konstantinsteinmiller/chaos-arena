// jsdom 28 in this project ships with a stub `localStorage` that's a plain
// empty object — `.getItem`, `.setItem`, `.removeItem`, `.clear` are all
// undefined. The save code under test treats `localStorage` as a Web
// Storage implementation, so we swap in a minimal in-memory polyfill for
// the duration of the save tests.

import { beforeEach } from 'vitest'

class MemoryStorage implements Storage {
  private map = new Map<string, string>()

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value))
  }
}

// Replace the jsdom stub up-front and before every test so that patching
// done by `SaveManager` doesn't leak across tests.
const install = (): void => {
  const storage = new MemoryStorage()
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true
  })
}

install()
beforeEach(install)
