import { Download } from 'lucide-react'
import { appConfig } from '../config'
import { Metric } from '../components/Metric'
import { PageIntro } from '../components/PageIntro'

export function ResultsPage() {
  return (
    <>
      <PageIntro eyebrow="EVIDENCE" title="Results" description="Compare variants and understand where the model succeeds or fails." action={<button className="outline-button"><Download size={15} /> Export report</button>} />
      <section className="panel result-overview">
        <div className="panel-heading"><div><h2>Zero-shot baseline</h2><p>{appConfig.model.name} · {appConfig.dataset.name} · {appConfig.study.sampleCount} images</p></div><span className="result-badge">{appConfig.study.modelVariant}</span></div>
        <div className="big-metrics">{[...appConfig.metrics, { label: 'Mean latency', value: appConfig.result.latency }].map((metric) => <Metric key={metric.label} {...metric} />)}</div>
        <div className="chart-placeholder"><div className="chart-grid-lines" /><div className="chart-bars">{appConfig.result.chart.map((height) => <span key={height} style={{ height: `${height}%` }} />)}</div><div className="chart-caption"><span>Baseline metrics overview</span><span>{appConfig.study.sampleCount} images</span></div></div>
      </section>
    </>
  )
}
