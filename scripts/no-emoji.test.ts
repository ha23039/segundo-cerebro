import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

// Emojis y símbolos pictográficos (incluye ✓ ▲ ▼ ↑ ↓ −): la UI usa iconos SVG de línea.
const PICTO = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{25A0}-\u{25FF}\u{2212}]/u

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx|css)$/.test(p) ? [p] : []
  })
}

test('la interfaz no usa emojis ni símbolos pictográficos', () => {
  const hits = walk('src').flatMap((f) =>
    readFileSync(f, 'utf8')
      .split('\n')
      .map((l, i) => (PICTO.test(l) ? `${f}:${i + 1}: ${l.trim()}` : null))
      .filter(Boolean),
  )
  expect(hits).toEqual([])
})
