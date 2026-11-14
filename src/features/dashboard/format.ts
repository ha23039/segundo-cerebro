export function pct(r: number | null): string {
  return r === null ? '—' : `${Math.round(r * 100)} %`
}

/** Diferencia en puntos porcentuales, o null si falta algún dato. */
export function deltaPts(cur: number | null, prev: number | null): number | null {
  return cur === null || prev === null ? null : Math.round((cur - prev) * 100)
}

export function greeting(hour: number): string {
  return hour < 6 ? 'Buenas noches' : hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
}
