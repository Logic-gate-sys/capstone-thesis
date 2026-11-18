import { Database, Plus, Search } from 'lucide-react'
import { appConfig } from '../config'
import { PageIntro } from '../components/PageIntro'

export function DatasetsPage() {
  return (
    <>
      <PageIntro eyebrow="DATA REGISTRY" title="Datasets" description="Version your data, labels, splits, and lineage." action={<button className="primary-button"><Plus size={15} /> Register dataset</button>} />
      <section className="table-panel">
        <div className="panel-heading"><div><h2>Registered datasets</h2><p>Fixed splits preserve reproducibility across experiments.</p></div><div className="search-box"><Search size={15} /><span>Search datasets</span></div></div>
        <div className="data-table">
          <div className="table-row table-header"><span>Name</span><span>Records</span><span>Split</span><span>Labels</span><span>Version</span></div>
          <div className="table-row"><strong><Database className="table-file" size={15} /> {appConfig.dataset.name}</strong><span>{appConfig.dataset.records}</span><span>{appConfig.dataset.split}</span><span>{appConfig.dataset.labels}</span><span className="version-tag">v1</span></div>
          <div className="table-row"><strong><Database className="table-file" size={15} /> {appConfig.secondaryDataset.name}</strong><span>{appConfig.secondaryDataset.records}</span><span>{appConfig.secondaryDataset.split}</span><span>{appConfig.secondaryDataset.labels}</span><span className="version-tag muted">{appConfig.secondaryDataset.version}</span></div>
        </div>
      </section>
    </>
  )
}
