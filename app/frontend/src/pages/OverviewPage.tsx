import { ArrowRight, Boxes, Check, MoreHorizontal, TriangleAlert } from 'lucide-react'
import { appConfig } from '../config'
import { ExperimentRow } from '../components/ExperimentRow'
import { Metric } from '../components/Metric'
import { PageIntro } from '../components/PageIntro'
import { useAppDispatch, useAppSelector } from '../hooks'
import { jobCompleted, jobProgress, jobStarted, setView } from '../store'

export function OverviewPage() {
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

  const stages = appConfig.pipelineStages.map((stage) => stage.title === 'Quantization'
    ? { ...stage, status: pipeline.status === 'running' ? `${pipeline.percent}% running` : stage.status, state: pipeline.status === 'running' ? 'running' : stage.state }
    : stage)

  return (
    <>
      <PageIntro eyebrow="RESEARCH WORKSPACE" title="Good morning, Daniel." description="Run reproducible local-model experiments from one place." action={<button className="primary-button" onClick={startDemoJob}>Run quick evaluation <ArrowRight size={15} /></button>} />
      <section className="hero-card">
        <div className="hero-copy"><span className="pill accent-pill">ACTIVE CASE STUDY</span><h2>{appConfig.study.title}</h2><p>{appConfig.study.description}</p><div className="hero-meta"><span>{appConfig.model.name}</span><span>·</span><span>{appConfig.study.lastRun}</span></div></div>
        <div className="hero-graphic"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="graphic-core"><Boxes size={30} strokeWidth={1.5} /></div><span className="graphic-label label-one">Q4</span><span className="graphic-label label-two">Q8</span><span className="graphic-label label-three">BASE</span></div>
      </section>
      <div className="section-heading"><div><h2>Research pipeline</h2><p>Track each stage from source model to evidence.</p></div><button className="link-button" onClick={() => dispatch(setView('experiments'))}>View experiments <ArrowRight size={14} /></button></div>
      <section className="stage-grid">
        {stages.map(({ number, title, subtitle, status, state }) => <div className={`stage-card ${state}`} key={title}><div className="stage-number">{state === 'complete' ? <Check size={16} strokeWidth={2} /> : number}</div><div className="stage-content"><h3>{title}</h3><span>{subtitle}</span></div><small>{status}</small></div>)}
      </section>
      <div className="dashboard-grid">
        <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent experiments</h2><p>Your latest reproducible runs</p></div><button className="icon-button" aria-label="Experiment menu"><MoreHorizontal size={18} /></button></div>{appConfig.experiments.map((experiment) => <ExperimentRow key={experiment.name} {...experiment} />)}</section>
        <section className="panel snapshot-panel"><div className="panel-heading"><div><h2>Latest result</h2><p>Zero-shot baseline · {appConfig.study.sampleCount} images</p></div><span className="result-badge">{appConfig.study.modelVariant}</span></div><div className="metric-row">{appConfig.metrics.map((metric) => <Metric key={metric.label} {...metric} />)}</div><div className="callout"><span className="callout-icon"><TriangleAlert size={17} /></span><p><strong>Over-calling detected</strong><br />The model flags {appConfig.result.baselineRate} of images positive against a {appConfig.result.observedRate} positive rate.</p></div></section>
      </div>
    </>
  )
}
