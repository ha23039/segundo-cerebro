/** Las 8 divisas principales y sus 28 combinaciones, en el orden habitual de las plataformas. */
export const FOREX_PAIRS: readonly string[] = [
  'EUR/USD', 'EUR/GBP', 'EUR/JPY', 'EUR/CHF', 'EUR/CAD', 'EUR/AUD', 'EUR/NZD',
  'GBP/USD', 'GBP/JPY', 'GBP/CHF', 'GBP/CAD', 'GBP/AUD', 'GBP/NZD',
  'USD/JPY', 'USD/CHF', 'USD/CAD',
  'AUD/USD', 'AUD/JPY', 'AUD/CHF', 'AUD/CAD', 'AUD/NZD',
  'NZD/USD', 'NZD/JPY', 'NZD/CHF', 'NZD/CAD',
  'CAD/JPY', 'CAD/CHF',
  'CHF/JPY',
]

/** Divisas que componen un par: `EUR/USD` pasa a `['EUR', 'USD']`. */
export const currenciesOf = (pair: string): string[] => pair.split('/').filter(Boolean)
