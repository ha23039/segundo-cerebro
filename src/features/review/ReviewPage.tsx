import { useId, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatLongDate } from '../../lib/dates'
import { toMessage } from '../../lib/errors'
import { pct } from '../dashboard/format'
import { useOnline } from '../layout/useOnline'
import { useStatsData } from '../stats/useStatsData'
import type { SavedReview } from './api'
import { buildReview, defaultWeek, REVIEW_LIMITS, reviewWeeks, validateReviewText, type Review, type Week, type WeekId } from './domain/review'
import { useReviewMutations, useReviews } from './hooks'
import './review.css'

const isWeek = (v: string | null): v is WeekId => v === 'actual' || v === 'anterior'

function deltaText(cur: number | null, prev: number | null): string | null {
  if (cur === null || prev === null) return null
  const d = Math.round((cur - prev) * 100)
  if (d === 0) return 'Igual que la semana anterior'
  return `${d > 0 ? '+' : '-'}${Math.abs(d)} puntos frente a la semana anterior`
}

function Summary({ review }: { review: Review }) {
  const delta = deltaText(review.ratio, review.previousRatio)
  return (
    <section className="card review-summary" aria-labelledby="review-numbers">
      <h2 id="review-numbers">Cómo fue la semana</h2>
      {review.scheduled === 0 ? (
        <p className="muted">No había nada programado en esta semana.</p>
      ) : (
        <>
          <p className="review-big">
            {pct(review.ratio)}
            <span className="muted small"> {review.done} de {review.scheduled} hechos</span>
          </p>
          {delta && <p className="muted small">{delta}</p>}
        </>
      )}
      {review.perfect.length > 0 && (
        <div>
          <h3 className="review-sub">Semana completa</h3>
          <ul className="review-list">
            {review.perfect.map((r) => (
              <li key={r.id}>{r.name}</li>
            ))}
          </ul>
        </div>
      )}
      {review.weakest.length > 0 && (
        <div>
          <h3 className="review-sub">Los que más costaron</h3>
          <ul className="review-list">
            {review.weakest.map((r) => (
              <li key={r.id}>
                {r.name} <span className="muted small">{r.done} de {r.scheduled}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Field({ id, label, hint, value, max, onChange }: { id: string; label: string; hint: string; value: string; max: number; onChange(v: string): void }) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <p className="muted small review-hint" id={`${id}-hint`}>
        {hint}
      </p>
      <textarea id={id} rows={3} value={value} maxLength={max + 200} aria-describedby={`${id}-hint`} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function Editor({ week, saved }: { week: Week; saved: SavedReview | undefined }) {
  const online = useOnline()
  const { save, remove } = useReviewMutations()
  const uid = useId()
  const [text, setText] = useState({ wentWell: saved?.wentWell ?? '', toImprove: saved?.toImprove ?? '', nextFocus: saved?.nextFocus ?? '' })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    const v = validateReviewText(text)
    if (!v.ok) return setError(v.error)
    setError(null)
    setDone(false)
    save.mutate({ weekStart: week.from, text: v.value }, { onSuccess: () => setDone(true) })
  }

  const set = (k: keyof typeof text) => (v: string) => {
    setText((t) => ({ ...t, [k]: v }))
    setDone(false)
    setError(null)
  }

  return (
    <form className="card review-form" onSubmit={submit} noValidate>
      <h2>Tu revisión</h2>
      <Field id={`${uid}-bien`} label="Qué fue bien" hint="Lo que quieres repetir." value={text.wentWell} max={REVIEW_LIMITS.wentWell} onChange={set('wentWell')} />
      <Field id={`${uid}-mejorar`} label="Qué mejorar" hint="Lo que se torció y por qué." value={text.toImprove} max={REVIEW_LIMITS.toImprove} onChange={set('toImprove')} />
      <Field id={`${uid}-foco`} label="Foco de la próxima semana" hint="Una o dos cosas, no más." value={text.nextFocus} max={REVIEW_LIMITS.nextFocus} onChange={set('nextFocus')} />
      {(error || save.isError || remove.isError) && (
        <p role="alert" className="error">
          {error ?? toMessage(save.error ?? remove.error)}
        </p>
      )}
      {!online && <p className="muted small">Sin conexión: no se puede guardar ahora.</p>}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={save.isPending || !online}>
          {save.isPending ? 'Guardando…' : saved ? 'Actualizar revisión' : 'Guardar revisión'}
        </button>
        {saved && (
          <button className="btn btn-danger" type="button" disabled={remove.isPending || !online} onClick={() => remove.mutate(saved.id)}>
            Borrar
          </button>
        )}
        {done && (
          <span role="status" className="muted small">
            Guardado
          </span>
        )}
      </div>
    </form>
  )
}

function PastReviews({ reviews, current }: { reviews: SavedReview[]; current: string }) {
  const others = reviews.filter((r) => r.weekStart !== current).slice(0, 8)
  if (others.length === 0) return null
  return (
    <section aria-labelledby="review-past">
      <h2 id="review-past">Revisiones anteriores</h2>
      <ul className="review-past">
        {others.map((r) => (
          <li key={r.id} className="card">
            <p className="eyebrow">Semana del {formatLongDate(r.weekStart)}</p>
            {r.wentWell && <p><strong>Bien:</strong> {r.wentWell}</p>}
            {r.toImprove && <p><strong>Mejorar:</strong> {r.toImprove}</p>}
            {r.nextFocus && <p><strong>Foco:</strong> {r.nextFocus}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ReviewPage() {
  const data = useStatsData()
  const reviews = useReviews()
  const [params, setParams] = useSearchParams()
  const weeks = reviewWeeks(data.today)
  const raw = params.get('semana')
  const id: WeekId = isWeek(raw) ? raw : defaultWeek(data.today)
  const week = weeks[id]
  const review = useMemo(() => buildReview(data.habits, data.logs, data.ex, week, data.today), [data.habits, data.logs, data.ex, week, data.today])
  const saved = reviews.data?.find((r) => r.weekStart === week.from)

  return (
    <div className="review">
      <div className="page-header">
        <h1>Revisión semanal</h1>
        <Link className="btn" to="/informe">
          Informe
        </Link>
      </div>

      <div className="day-picker" role="group" aria-label="Semana">
        {(['anterior', 'actual'] as const).map((w) => (
          <button key={w} type="button" className="btn day-btn" aria-pressed={id === w} onClick={() => setParams({ semana: w }, { replace: true })}>
            {w === 'actual' ? 'Esta semana' : 'Semana pasada'}
          </button>
        ))}
      </div>
      <p className="muted">
        Del {formatLongDate(week.from)} al {formatLongDate(week.to)}
      </p>

      {data.error && (
        <p role="alert" className="error">
          {toMessage(data.error)}
        </p>
      )}
      {data.loading || reviews.isPending ? <p className="muted">Cargando…</p> : (
        <>
          <Summary review={review} />
          <Editor key={week.from} week={week} saved={saved} />
          <PastReviews reviews={reviews.data ?? []} current={week.from} />
        </>
      )}
    </div>
  )
}
