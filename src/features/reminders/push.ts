/** Acceso a las notificaciones push del navegador. Solo funciona con la app instalada en iPhone (iOS 16.4 o posterior). */

export type PushSupport = 'ok' | 'instalar' | 'sin-soporte'

function isIos(): boolean {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function pushSupport(): PushSupport {
  // En iOS, fuera de la app instalada Safari ni siquiera expone PushManager
  if (isIos() && !isInstalled()) return 'instalar'
  const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  return ok ? 'ok' : 'sin-soporte'
}

export function urlBase64ToBytes(text: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (text.length % 4)) % 4)
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export interface SubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

export function toRow(sub: PushSubscription): SubscriptionRow {
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Suscripción incompleta')
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** Pide permiso (debe llamarse desde un toque del usuario) y suscribe este dispositivo. */
export async function subscribeThisDevice(vapidPublicKey: string): Promise<PushSubscription> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('permiso-denegado')
  const reg = await navigator.serviceWorker.ready
  return (
    (await reg.pushManager.getSubscription()) ??
    reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(vapidPublicKey) })
  )
}

export async function unsubscribeThisDevice(): Promise<string | null> {
  const sub = await currentSubscription()
  if (!sub) return null
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  return endpoint
}
