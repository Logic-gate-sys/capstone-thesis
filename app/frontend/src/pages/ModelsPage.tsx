import { useEffect, useState, type FormEvent } from 'react'
import { Boxes, Download, MoreHorizontal, Plus, Search } from 'lucide-react'
import { Events } from '@wailsio/runtime'
import { appConfig } from '../config'
import { PageIntro } from '../components/PageIntro'
import { ListModels, SearchModels, StartModelDownload } from '../../bindings/app/internal/services/modelservice'
import { WorkerEvent,  } from '../../bindings/events'
import { useAppDispatch, useAppSelector } from '../hooks'
import { downloadQueued, searchStarted, workerEventReceived, type WorkerEventPayload } from '../redux_store/store'

function unwrapWorkerPayload(raw: unknown): WorkerEventPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate =
    'data' in raw && raw.data && typeof raw.data === 'object' ? raw.data : raw
  return candidate as WorkerEventPayload
}

export function ModelsPage() {
  const dispatch = useAppDispatch()
  const { isSearching, searchResults, searchError, downloadsByJobId } = useAppSelector((state) => state.models)
  const [query, setQuery] = useState('Qwen2-VL-1.5B')

  useEffect(() => {
    const unsubscribe = Events.On(WorkerEvent, (rawEvent) => {
      console.log("EVENT: ", rawEvent)
      const payload = unwrapWorkerPayload(rawEvent)
      if (payload?.event) {
        dispatch(workerEventReceived(payload))
      }
    })

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [dispatch])

  const runSearch = async (searchQuery: string) => {
    //tream query
    const trimmed = searchQuery.trim()
    if (!trimmed) return
    const jobId = await SearchModels(trimmed, '', '', 10)
    if (jobId) dispatch(searchStarted({ jobId }));
  }

  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await runSearch(query)
  }

  const handleDownload = async (repoId: string) => {
    const res = await StartModelDownload(repoId, 'main', 'qwen-vl')
    const jobId = typeof res?.job_id === 'string' ? res.job_id : ''
    if (jobId) {
      dispatch(downloadQueued({ jobId, repoId }))
      await ListModels()
    }
  }

  const activeDownloads = Object.values(downloadsByJobId)

  return (
    <>
      <PageIntro
        eyebrow="MODEL REGISTRY"
        title="Models"
        description="Manage source checkpoints, adapters, and deployment artifacts."
        action={
          <button
            type="button"
            className="flex h-12 items-center gap-2 rounded-full bg-[#25283a] px-5 text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(37,40,58,.18)] disabled:opacity-60"
            onClick={() => runSearch(query)}
            disabled={isSearching}
          >
            <Plus size={15} /> {isSearching ? 'Searching...' : 'Search Hub'}
          </button>
        }
      />

      <form onSubmit={handleSearchSubmit} className="mb-5 flex h-12 items-center gap-3 rounded-[18px] border border-[#e0e3ea] bg-white px-4 shadow-[0_8px_20px_rgba(37,40,58,.055)]">
        <Search size={18} className="text-[#9299aa]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Hugging Face models (e.g., Qwen2-VL)..."
          aria-label="Search Hugging Face models"
          className="min-w-0 flex-1 bg-transparent text-[12px] outline-none"
        />
        <button type="submit" className="h-9 rounded-full bg-[#25283a] px-5 text-[11px] font-bold text-white disabled:opacity-60" disabled={isSearching}>
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {searchError && (
        <p role="alert" className="mb-5 rounded-[18px] border border-[#e0e3ea] bg-white px-5 py-4 text-[12px] font-bold text-[#697187]">
          {searchError}
        </p>
      )}

      {activeDownloads.length > 0 && (
        <section className="mb-5 grid grid-cols-3 gap-5" aria-label="Active downloads">
          {activeDownloads.map((dl) => (
            <div key={dl.jobId} className="rounded-[28px] border border-[#e0e3ea] bg-[linear-gradient(145deg,#fff,#fafbfc)] p-6 shadow-[0_14px_30px_rgba(37,40,58,.09)]">
              <div className="mb-5 grid size-12 place-items-center rounded-[15px] bg-[#25283a] text-white">
                <Download size={21} strokeWidth={1.7} />
              </div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#f1f3f6] px-3 py-1.5 text-[10px] font-bold">{dl.status.toUpperCase()}</span>
                <span className="text-[11px] font-bold">{dl.progress}%</span>
              </div>
              <h3 className="mt-4 text-[13px] font-bold">{dl.repoId}</h3>
              <p className="mt-2 text-[11px] text-[#9299aa]">
                {dl.error
                  ? dl.error
                  : dl.message ?? `Job ${dl.jobId} — ${dl.status}`}
              </p>
              {dl.artifactPath && (
                <div className="mt-4 flex">
                  <span>{dl.artifactPath}</span>
                </div>
              )}
              <div className="mt-5 flex justify-between border-t border-[#edf0f4] pt-4 text-[10px] text-[#9299aa]">
                <span>Progress: {dl.progress}%</span>
                <span>{dl.checksum ? `SHA: ${dl.checksum.slice(0, 8)}` : dl.jobId}</span>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="grid grid-cols-3 gap-5">
        <div className="rounded-[28px] border border-[#e0e3ea] bg-[linear-gradient(145deg,#fff,#fafbfc)] p-6 shadow-[0_14px_30px_rgba(37,40,58,.09),0_1px_0_rgba(255,255,255,.95)_inset]">
          <div className="mb-5 grid size-12 place-items-center rounded-[15px] bg-[#25283a] text-white">
            <Boxes size={21} strokeWidth={1.7} />
          </div>
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-[#f1f3f6] px-3 py-1.5 text-[10px] font-bold">READY</span>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full text-[#9299aa] hover:bg-[#f1f3f6]"
              aria-label="Model menu"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
          <h3 className="mt-4 text-[13px] font-bold">{appConfig.model.name}</h3>
          <p className="mt-2 text-[11px] text-[#9299aa]">{appConfig.model.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {appConfig.model.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-[#edf0f4] px-3 py-1.5 text-[9px] font-bold">{tag}</span>
            ))}
          </div>
          <div className="mt-5 flex justify-between border-t border-[#edf0f4] pt-4 text-[10px] text-[#9299aa]">
            <span>{appConfig.model.variants}</span>
            <span>Updated today</span>
          </div>
        </div>

        {searchResults.map((model) => {
          const matchingDownload = activeDownloads.find(
            (d) => d.repoId === model.repo_id
          )
          return (
            <div key={model.repo_id} className="rounded-[28px] border border-[#e0e3ea] bg-[linear-gradient(145deg,#fff,#fafbfc)] p-6 shadow-[0_14px_30px_rgba(37,40,58,.09),0_1px_0_rgba(255,255,255,.95)_inset]">
              <div className="mb-5 grid size-12 place-items-center rounded-[15px] bg-[#25283a] text-white">
                <Boxes size={21} strokeWidth={1.7} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="max-w-[55%] truncate rounded-full bg-[#f1f3f6] px-3 py-1.5 text-[10px] font-bold">
                  {model.pipeline_tag ?? 'MODEL'}
                </span>
                <button
                  type="button"
                  className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-[#25283a] px-3 text-[10px] font-bold text-white disabled:opacity-60"
                  onClick={() => handleDownload(model.repo_id)}
                  disabled={matchingDownload?.status === 'downloading'}
                >
                  <Download size={14} />
                  {matchingDownload?.status === 'downloading'
                    ? `${matchingDownload.progress}%`
                    : 'Download'}
                </button>
              </div>
              <h3 className="mt-4 break-words text-[13px] font-bold">{model.repo_id}</h3>
              <p className="mt-2 text-[11px] text-[#9299aa]">{model.library_name ?? 'Hugging Face Checkpoint'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(model.tags ?? []).slice(0, 3).map((tag) => (
                  <span key={tag} className="max-w-full truncate rounded-full border border-[#edf0f4] px-3 py-1.5 text-[9px] font-bold">{tag}</span>
                ))}
              </div>
              <div className="mt-5 flex justify-between border-t border-[#edf0f4] pt-4 text-[10px] text-[#9299aa]">
                <span>Downloads: {model.downloads ?? 0}</span>
                <span>Likes: {model.likes ?? 0}</span>
              </div>
            </div>
          )
        })}

        <div
          className="flex min-h-55 cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-[#d9dde6] bg-[#fafbfc] text-[#9299aa] shadow-[0_8px_20px_rgba(37,40,58,.035)_inset]"
          onClick={() => runSearch(query)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              runSearch(query)
            }
          }}
        >
          <Plus size={26} />
          <strong className="mt-3 text-[13px] text-[#697187]">Search or register another model</strong>
          <small className="mt-2 text-[10px]">Query Hugging Face or import a checkpoint artifact</small>
        </div>
      </section>
    </>
  )
}
