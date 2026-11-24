import { beforeEach, describe, expect, it, vi } from 'vitest'
const store = vi.hoisted(() => new Map<string, unknown>())
vi.mock('idb-keyval', () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => void store.set(k, v),
  del: async (k: string) => void store.delete(k),
}))

import { clearOutbox, coalesce, enqueueLog, flushOutbox, isNetworkFailure, loadOutbox, overlay, pendingLogs } from './outbox'

describe('coalesce', () => {
  it('el último cambio sobre una casilla reemplaza al anterior', () => {
    const a = coalesce([], { habitId: 'h', date: '2026-11-23', value: 1 })
    const b = coalesce(a, { habitId: 'h', date: '2026-11-23', value: null })
    expect(b).toEqual([{ habitId: 'h', date: '2026-11-23', value: null }])
  })
  it('conserva las demás casillas y el orden', () => {
    const list = coalesce(coalesce([], { habitId: 'a', date: '2026-11-23', value: 1 }), { habitId: 'b', date: '2026-11-23', value: 2 })
    expect(coalesce(list, { habitId: 'a', date: '2026-11-23', value: 3 }).map((p) => p.habitId)).toEqual(['b', 'a'])
  })
})

describe('overlay', () => {
  it('pone y quita valores sin tocar el original', () => {
    const base = { h: { '2026-11-22': 1 } }
    const out = overlay(base, [
      { habitId: 'h', date: '2026-11-23', value: 5 },
      { habitId: 'h', date: '2026-11-22', value: null },
      { habitId: 'otro', date: '2026-11-23', value: 1 },
    ])
    expect(out).toEqual({ h: { '2026-11-23': 5 }, otro: { '2026-11-23': 1 } })
    expect(base).toEqual({ h: { '2026-11-22': 1 } })
  })
  it('sin pendientes devuelve el mismo objeto', () => {
    const base = { h: { '2026-11-22': 1 } }
    expect(overlay(base, [])).toBe(base)
  })
})

describe('isNetworkFailure', () => {
  it('reconoce los fallos de red y no los demás', () => {
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkFailure({ message: 'Load failed' })).toBe(true)
    expect(isNetworkFailure({ code: '23514', message: 'Fecha fuera de la ventana de edición' })).toBe(false)
    expect(isNetworkFailure(null)).toBe(false)
  })
})

describe('flushOutbox', () => {
  beforeEach(async () => {
    await clearOutbox()
    await loadOutbox('u1')
  })

  it('envía en orden y vacía la cola', async () => {
    enqueueLog({ habitId: 'a', date: '2026-11-23', value: 1 })
    enqueueLog({ habitId: 'b', date: '2026-11-23', value: 2 })
    const sent: string[] = []
    const n = await flushOutbox(async (p) => void sent.push(p.habitId))
    expect(n).toBe(2)
    expect(sent).toEqual(['a', 'b'])
    expect(pendingLogs()).toEqual([])
  })

  it('si falla la red se detiene y conserva lo que falta', async () => {
    enqueueLog({ habitId: 'a', date: '2026-11-23', value: 1 })
    enqueueLog({ habitId: 'b', date: '2026-11-23', value: 1 })
    const send = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await flushOutbox(send)).toBe(1)
    expect(pendingLogs().map((p) => p.habitId)).toEqual(['b'])
  })

  it('descarta el cambio que el servidor rechaza y sigue con los demás', async () => {
    enqueueLog({ habitId: 'viejo', date: '2026-10-01', value: 1 })
    enqueueLog({ habitId: 'bien', date: '2026-11-23', value: 1 })
    const send = vi.fn().mockRejectedValueOnce({ code: '23514', message: 'Fecha fuera de la ventana de edición' }).mockResolvedValueOnce(undefined)
    expect(await flushOutbox(send)).toBe(1)
    expect(pendingLogs()).toEqual([])
  })

  it('un cambio nuevo sobre la casilla mientras se envía no se pierde', async () => {
    enqueueLog({ habitId: 'a', date: '2026-11-23', value: 1 })
    let first = true
    const sent: (number | null)[] = []
    await flushOutbox(async (p) => {
      sent.push(p.value)
      if (first) {
        first = false
        enqueueLog({ habitId: 'a', date: '2026-11-23', value: null })
      }
    })
    // Se envía el primero y, como la casilla cambió, también el último valor: nada se pierde
    expect(sent).toEqual([1, null])
    expect(pendingLogs()).toEqual([])
  })

  it('cerrar sesión vacía la cola', async () => {
    enqueueLog({ habitId: 'a', date: '2026-11-23', value: 1 })
    await clearOutbox()
    expect(pendingLogs()).toEqual([])
  })
})
