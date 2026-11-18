import { ArrowRight, FlaskConical } from 'lucide-react'
import type { Experiment } from '../config'

export function ExperimentRow({ name, model, status, metric, tone }: Experiment) {
  return (
    <div className="experiment-row">
      <div className="experiment-icon"><FlaskConical size={17} strokeWidth={1.8} /></div>
      <div className="experiment-details"><strong>{name}</strong><span>{model}</span></div>
      <span className={`status-label ${tone}`}>{status}</span>
      <strong className="row-metric">{metric}</strong>
      <ArrowRight className="row-arrow" size={16} />
    </div>
  )
}
