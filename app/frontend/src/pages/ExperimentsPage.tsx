import { ArrowRight, ChevronDown, Plus } from 'lucide-react'
import { appConfig } from '../config'
import { ExperimentRow } from '../components/ExperimentRow'
import { PageIntro } from '../components/PageIntro'
import { useAppDispatch, useAppSelector } from '../hooks'
import { jobCompleted, jobProgress, jobStarted } from '../store'

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
      <PageIntro eyebrow="EXPERIMENTS" title="Experiments" description="Configure, run, and compare model lifecycle workflows." action={<button className="primary-button" onClick={startDemoJob}><Plus size={15} /> Start experiment</button>} />
      <div className="experiment-layout">
        <section className="panel experiment-list">
          <div className="panel-heading"><div><h2>All experiments</h2><p>{experiments.length} workflows in this workspace</p></div><span className="filter-button">All statuses <ChevronDown size={13} /></span></div>
          {experiments.map((experiment) => <ExperimentRow key={experiment.name} {...experiment} />)}
        </section>
        <section className="panel selected-experiment">
          <span className="pill accent-pill">NEXT UP</span>
          <h2>{appConfig.selectedExperiment.name}</h2>
          <p>{appConfig.selectedExperiment.description}</p>
          <div className="detail-list"><div><span>Source</span><strong>{appConfig.model.name} · F16</strong></div><div><span>Target</span><strong>{appConfig.selectedExperiment.target}</strong></div><div><span>Dataset</span><strong>{appConfig.dataset.name} · test split</strong></div></div>
          <button className="primary-button full-button" onClick={startDemoJob}>Run quantization workflow <ArrowRight size={15} /></button>
        </section>
      </div>
    </>
  )
}
