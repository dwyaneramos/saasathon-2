import { get, set } from 'idb-keyval'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DOCUMENTS, type JobDocument } from '../data/documents'

// One key for every uploaded document, not one per project: writes only happen when a
// pipeline run finishes, and a single key lets the detail page resolve a document by id
// without first knowing which project it belongs to.
const STORAGE_KEY = 'documents:uploads'

export function useDocuments() {
  const [uploads, setUploads] = useState<JobDocument[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    get<JobDocument[]>(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled) setUploads(stored ?? [])
      })
      .catch(() => {
        if (!cancelled) setUploads([])
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback((next: JobDocument[]) => {
    setUploads(next)
    set(STORAGE_KEY, next).catch((err) => console.error('Failed to save documents', err))
  }, [])

  const actions = useMemo(
    () => ({
      // Re-running the pipeline over a file replaces the stored copy rather than duplicating it.
      addDocuments: (docs: JobDocument[]) => {
        const incoming = new Set(docs.map((doc) => doc.id))
        persist([...docs, ...uploads.filter((doc) => !incoming.has(doc.id))])
      },
    }),
    [persist, uploads],
  )

  return { documents: useMemo(() => [...DOCUMENTS, ...uploads], [uploads]), loaded, ...actions }
}
