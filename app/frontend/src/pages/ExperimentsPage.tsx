import { ArrowRight, ChevronDown, Plus } from 'lucide-react'
import { appConfig } from '../config'
import { ExperimentRow } from '../components/ExperimentRow'
import { PageIntro } from '../components/PageIntro'
import { useAppDispatch, useAppSelector } from '../hooks'
import { jobCompleted, jobProgress, jobStarted } from '../redux_store/store'

export function ExperimentsPage() {
  const dispatch = useAppDispatch()
  const pipeline = useAppSelector((state) => state.pipeline)

  const startDemoJob = () => {
    dispatch(jobStarted({ jobId: 'demo-quantize', stage: 'quantize' }))
    dispatch(jobProgress({ stage: 'quantize', percent: 42 }))
    window.setTimeout(() => {
      dispatch(jobProgress({ stage: 'quantize', percent: 100 }))
      dispatch(jobCompleted())
    }, 850)
  }

  const experiments = appConfig.experiments.map((experiment) => experiment.name === appConfig.selectedExperiment.name
    ? { ...experiment, status: pipeline.status === 'running' ? 'Running' : experiment.status, tone: pipeline.status === 'running' ? 'running' : experiment.tone }
    : experiment)

  return (
    <>
      <PageIntro eyebrow="EXPERIMENTS" title="Experiments" description="Configure, run, and compare model lifecycle workflows." action={<button className="flex h-12 items-center gap-2 rounded-full bg-[#25283a] px-5 text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(37,40,58,.18)]" onClick={startDemoJob}><Plus size={17} /> Start experiment</button>} />
      <div className="grid grid-cols-[minmax(480px,1.75fr)_minmax(300px,.75fr)] gap-5">
        <section className="rounded-[28px] border border-[#e0e3ea] bg-[linear-gradient(145deg,#fff,#fafbfc)] p-7 shadow-[0_14px_30px_rgba(37,40,58,.09),0_1px_0_rgba(255,255,255,.95)_inset]">
          <div className="flex items-center justify-between border-b border-[#edf0f4] pb-5"><div><h2 className="text-[15px] font-bold">All experiments</h2><p className="mt-1 text-[11px] font-semibold text-[#9299aa]">{experiments.length} workflows in this workspace</p></div><span className="flex items-center gap-2 rounded-full bg-[#f1f3f6] px-3 py-2 text-[10px] font-bold">All statuses <ChevronDown size={13} /></span></div>
          <div className="pt-2">{experiments.map((experiment) => <ExperimentRow key={experiment.name} {...experiment} />)}</div>
        </section>
        <section className="rounded-[28px] border border-[#e0e3ea] bg-[linear-gradient(145deg,#fff,#fafbfc)] p-7 shadow-[0_14px_30px_rgba(37,40,58,.09),0_1px_0_rgba(255,255,255,.95)_inset]">
          <span className="rounded-full bg-[#f1f3f6] px-3 py-1.5 text-[10px] font-bold">NEXT UP</span>
          <h2 className="mt-5 text-[15px] font-bold">{appConfig.selectedExperiment.name}</h2>
          <p className="mt-2 text-[11px] leading-5 text-[#9299aa]">{appConfig.selectedExperiment.description}</p>
          <div className="mt-6 space-y-4"><div><span className="text-[10px] text-[#9299aa]">Source</span><strong className="block mt-1 text-[11px]">{appConfig.model.name} · F16</strong></div><div><span className="text-[10px] text-[#9299aa]">Target</span><strong className="block mt-1 text-[11px]">{appConfig.selectedExperiment.target}</strong></div><div><span className="text-[10px] text-[#9299aa]">Dataset</span><strong className="block mt-1 text-[11px]">{appConfig.dataset.name} · test split</strong></div></div>
          <button className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#25283a] text-[11px] font-bold text-white" onClick={startDemoJob}>Run quantization workflow <ArrowRight size={15} /></button>
        </section>
      </div>
    </>
  )
}
