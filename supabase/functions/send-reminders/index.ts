// Envía los recordatorios que la base de datos dice que toca enviar ahora (public.due_reminders).
// Se llama cada minuto desde pg_cron (ver docs/recordatorios.md). Secretos de la función: VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT y CRON_SECRET. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las pone Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendWebPush, type VapidKeys } from '../_shared/webpush.ts'

interface Due {
  user_id: string
  kind: 'habito' | 'repaso' | 'revision'
  ref: string
  day: string
  title: string
  body: string
  url: string
}

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET') ?? ''
  const given = req.headers.get('x-cron-secret') ?? ''
  if (!secret || !sameSecret(secret, given)) return new Response('No autorizado', { status: 401 })

  const vapid: VapidKeys = {
    publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
    privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    subject: Deno.env.get('VAPID_SUBJECT') ?? '',
  }
  if (!vapid.publicKey || !vapid.privateKey || !vapid.subject) return new Response('Faltan las claves VAPID', { status: 500 })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data, error } = await db.rpc('due_reminders')
  if (error) return new Response(`Error al consultar: ${error.message}`, { status: 500 })

  const due = (data ?? []) as Due[]
  let sent = 0
  let removed = 0
  for (const d of due) {
    const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', d.user_id)
    let delivered = false
    for (const s of subs ?? []) {
      try {
        const r = await sendWebPush(s, { title: d.title, body: d.body, url: d.url }, vapid)
        if (r.status >= 200 && r.status < 300) delivered = true
        if (r.gone) {
          await db.from('push_subscriptions').delete().eq('id', s.id)
          removed++
        }
      } catch {
        // un dispositivo que falla no impide avisar a los demás
      }
    }
    // Solo se marca como enviado si llegó a algún dispositivo: si no, se reintenta el minuto siguiente (dentro de la ventana)
    if (delivered) {
      await db.from('reminder_log').upsert({ user_id: d.user_id, kind: d.kind, ref: d.ref, day: d.day }, { onConflict: 'user_id,kind,ref,day', ignoreDuplicates: true })
      sent++
    }
  }
  return Response.json({ due: due.length, sent, removed })
})
