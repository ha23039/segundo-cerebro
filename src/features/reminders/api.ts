import { supabase } from '../../lib/supabase'
import type { ReminderPrefs } from './domain/prefs'
import type { SubscriptionRow } from './push'

export async function saveSubscription(row: SubscriptionRow): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'user_id,endpoint', ignoreDuplicates: true })
  if (error) throw error
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}

export async function savePrefs(userId: string, prefs: ReminderPrefs): Promise<void> {
  const { error } = await supabase.from('profiles').update({ reminders: { ...prefs } }).eq('user_id', userId)
  if (error) throw error
}
