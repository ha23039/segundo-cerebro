import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import temaSrc from '../../public/theme.js?raw'
import { getThemePrefs, setMode, setPalette } from './theme'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.palette
  delete document.documentElement.dataset.theme
  new Function(temaSrc)()
})

afterEach(() => vi.restoreAllMocks())

test('setPalette aplica y persiste la paleta', () => {
  setPalette('oceano')
  expect(document.documentElement.dataset.palette).toBe('oceano')
  expect(getThemePrefs().palette).toBe('oceano')
})

test('setMode oscuro marca data-theme', () => {
  setMode('dark')
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(getThemePrefs().mode).toBe('dark')
})

test('setMode automático quita data-theme', () => {
  setMode('dark')
  setMode('auto')
  expect(document.documentElement.dataset.theme).toBeUndefined()
  expect(getThemePrefs().mode).toBe('auto')
})

test('sin acceso a localStorage devuelve los valores por defecto', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('bloqueado')
  })
  expect(getThemePrefs()).toEqual({ palette: 'indigo', mode: 'auto' })
})
