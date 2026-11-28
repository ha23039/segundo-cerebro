import { describe, expect, it } from 'vitest'
import { currenciesOf, FOREX_PAIRS } from './forex'

describe('pares de forex', () => {
  it('son 28, sin repetidos, y cada combinación de las 8 divisas aparece una vez', () => {
    expect(FOREX_PAIRS).toHaveLength(28)
    expect(new Set(FOREX_PAIRS).size).toBe(28)
    const unordered = new Set(FOREX_PAIRS.map((p) => currenciesOf(p).sort().join('-')))
    expect(unordered.size).toBe(28)
    const currencies = new Set(FOREX_PAIRS.flatMap(currenciesOf))
    expect([...currencies].sort()).toEqual(['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'JPY', 'NZD', 'USD'])
  })
  it('cada divisa participa en 7 pares', () => {
    for (const c of ['EUR', 'USD', 'JPY']) expect(FOREX_PAIRS.filter((p) => currenciesOf(p).includes(c))).toHaveLength(7)
  })
})
