export interface JournalEntry {
  id: string
  date: string
  body: string
  updatedAt: string
}

export interface Note {
  id: string
  title: string
  body: string
  tags: string[]
  pinned: boolean
  updatedAt: string
  deletedAt: string | null
}
