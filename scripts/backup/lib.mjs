// Lógica pura del respaldo (sin red ni disco) para poder probarla.

/** Nombre del objeto en R2: backup-YYYY-MM-DD.tar.gz.age (la fecha ordena los respaldos). */
export function backupKey(date = new Date()) {
  return `backup-${date.toISOString().slice(0, 10)}.tar.gz.age`
}

const KEY_RE = /^backup-\d{4}-\d{2}-\d{2}\.tar\.gz\.age$/

/** Claves a borrar para conservar solo las `keep` más recientes. Ignora cualquier objeto que no sea un respaldo. */
export function keysToDelete(keys, keep = 12) {
  const backups = keys.filter((k) => KEY_RE.test(k)).sort()
  return backups.slice(0, Math.max(0, backups.length - keep))
}

/** Los respaldos solo se restauran en una base vacía: cuenta de filas por tabla -> mensaje de error o null. */
export function nonEmptyTables(counts) {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${t} (${n})`)
}

/** Una clave pública age válida (age1…); nunca se acepta una privada (AGE-SECRET-KEY-…). */
export function isAgeRecipient(s) {
  return /^age1[02-9ac-hj-np-z]{58}$/.test(s.trim())
}
