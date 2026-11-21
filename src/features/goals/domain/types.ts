import type { IsoDate } from '../../../lib/dates'

export type GoalStatus = 'activo' | 'completado' | 'abandonado'

export interface Milestone {
  id: string
  title: string
  done: boolean
  position: number
}

export interface Goal {
  id: string
  title: string
  description: string | null
  startDate: IsoDate
  dueDate: IsoDate
  status: GoalStatus
  completedAt: string | null
  milestones: Milestone[]
}
