import { useState } from 'react'
import { Link } from 'react-router'
import { toMessage } from '../../lib/errors'
import { useOnline } from '../layout/useOnline'
import { fetchAllData } from './api'
import { buildCsvFiles, buildJson, fileStamp } from './domain/bundle'
import { zipStore } from './domain/zip'
import { downloadFile } from './download'

type Format = 'json' | 'csv'

/** "Descargar mis datos": solo exportar (la app no importa). Se genera en el dispositivo; nada se envía a terceros. */
export function ExportCard() {
  const online = useOnline()
  const [busy, setBusy] = useState<Format | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(format: Format) {
    setBusy(format)
    setDone(null)
    setError(null)
    try {
      const data = await fetchAllData()
      const now = new Date()
      const stamp = fileStamp(now)
      const rows = Object.values(data).reduce((n, r) => n + r.length, 0)
      if (format === 'json') {
        downloadFile(`segundo-cerebro-${stamp}.json`, buildJson(data, now), 'application/json')
      } else {
        downloadFile(`segundo-cerebro-${stamp}.zip`, zipStore(buildCsvFiles(data), now) as BlobPart, 'application/zip')
      }
      setDone(`Descarga lista: ${rows} registros.`)
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="stack" aria-labelledby="datos">
      <h2 id="datos">Tus datos</h2>
      <p className="muted">Descarga todo lo que has guardado: hábitos, registros, objetivos, foco, diario y notas. Solo exportar; no se importa en la app.</p>
      <div className="row">
        <button type="button" className="btn" disabled={!online || busy !== null} onClick={() => run('json')}>
          {busy === 'json' ? 'Preparando…' : 'Descargar JSON'}
        </button>
        <button type="button" className="btn" disabled={!online || busy !== null} onClick={() => run('csv')}>
          {busy === 'csv' ? 'Preparando…' : 'Descargar CSV (zip)'}
        </button>
        <Link className="btn" to="/informe">
          Informe imprimible
        </Link>
      </div>
      <p role="status" className="muted small">
        {done ?? ''}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  )
}
