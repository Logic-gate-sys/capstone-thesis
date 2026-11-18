import { Boxes, MoreHorizontal, Plus } from 'lucide-react'
import { appConfig } from '../config'
import { PageIntro } from '../components/PageIntro'

export function ModelsPage() {
  return (
    <>
      <PageIntro eyebrow="MODEL REGISTRY" title="Models" description="Manage source checkpoints, adapters, and deployment artifacts." action={<button className="primary-button"><Plus size={15} /> Register model</button>} />
      <section className="card-grid">
        <div className="resource-card featured">
          <div className="resource-icon model-icon"><Boxes size={20} strokeWidth={1.7} /></div>
          <div className="resource-card-head"><span className="pill green-pill">READY</span><button className="icon-button" aria-label="Model menu"><MoreHorizontal size={18} /></button></div>
          <h3>{appConfig.model.name}</h3><p>{appConfig.model.summary}</p>
          <div className="resource-tags">{appConfig.model.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <div className="resource-footer"><span>{appConfig.model.variants}</span><span>Updated today</span></div>
        </div>
        <div className="empty-resource"><Plus size={24} /><strong>Register another model</strong><small>Import a checkpoint or GGUF artifact</small></div>
      </section>
    </>
  )
}
