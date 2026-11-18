import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Window } from '@wailsio/runtime'
import {
  ArrowRight,
  Boxes,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  CircleHelp,
  Copy,
  Database,
  Download,
  FilePlus2,
  FlaskConical,
  FolderOpen,
  LayoutDashboard,
  MoreHorizontal,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  Plus,
  Search,
  Settings,
  Square,
  TriangleAlert,
  X,
  Check,
  Trash2,
} from 'lucide-react'
import {
  jobCompleted,
  jobProgress,
  jobStarted,
  RootState,
} from './store'
import { appConfig, type Experiment, type View, type Workspace, workflowOptions } from './config'

const navigationIcons = {
  overview: LayoutDashboard,
  models: Boxes,
  datasets: Database,
  experiments: FlaskConical,
  results: ChartNoAxesColumnIncreasing,
}

function App() {
  const [view, setView] = useState<View>('overview')
  const [showNewExperiment, setShowNewExperiment] = useState(false)
  const [maximised, setMaximised] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(248)
  const [sidebarResizing, setSidebarResizing] = useState(false)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [workspaceDialog, setWorkspaceDialog] = useState<'create' | 'rename' | 'delete' | null>(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    try {
      const saved = localStorage.getItem('ml-workbench-workspaces')
      return saved ? JSON.parse(saved) as Workspace[] : [...appConfig.workspaces]
    } catch {
      return [...appConfig.workspaces]
    }
  })
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    return localStorage.getItem('ml-workbench-active-workspace') || 'wound-triage'
  })
  const dispatch = useDispatch()
  const pipeline = useSelector((state: RootState) => state.pipeline)
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0]

  useEffect(() => {
    localStorage.setItem('ml-workbench-workspaces', JSON.stringify(workspaces))
  }, [workspaces])

  useEffect(() => {
    if (activeWorkspace) {
      localStorage.setItem('ml-workbench-active-workspace', activeWorkspace.id)
    }
  }, [activeWorkspace])

  const startDemoJob = () => {
    dispatch(jobStarted({ jobId: 'demo-quantize', stage: 'quantize' }))
    dispatch(jobProgress({ stage: 'quantize', percent: 42 }))
    window.setTimeout(() => {
      dispatch(jobProgress({ stage: 'quantize', percent: 100 }))
      dispatch(jobCompleted())
    }, 850)
  }

  const toggleMaximise = async () => {
    await Window.ToggleMaximise()
    setMaximised(await Window.IsMaximised())
  }

  useEffect(() => {
    if (!sidebarResizing) return

    const handlePointerMove = (event: PointerEvent) => {
      const maximum = Math.floor(window.innerWidth / 3)
      setSidebarWidth(Math.min(maximum, Math.max(220, event.clientX)))
    }

    const stopResizing = () => setSidebarResizing(false)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
    }
  }, [sidebarResizing])

  const openWorkspaceDialog = (dialog: 'create' | 'rename' | 'delete') => {
    setWorkspaceMenuOpen(false)
    setWorkspaceName(dialog === 'rename' ? activeWorkspace?.name || '' : '')
    setWorkspaceDialog(dialog)
  }

  const submitWorkspaceDialog = () => {
    if (workspaceDialog === 'create') {
      const name = workspaceName.trim()
      if (!name) return
      const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'}-${Date.now()}`
      const workspace = { id, name }
      setWorkspaces((current) => [...current, workspace])
      setActiveWorkspaceId(id)
    } else if (workspaceDialog === 'rename' && activeWorkspace) {
      const name = workspaceName.trim()
      if (!name) return
      setWorkspaces((current) => current.map((workspace) => workspace.id === activeWorkspace.id ? { ...workspace, name } : workspace))
    } else if (workspaceDialog === 'delete' && activeWorkspace && workspaces.length > 1) {
      const remaining = workspaces.filter((workspace) => workspace.id !== activeWorkspace.id)
      setWorkspaces(remaining)
      setActiveWorkspaceId(remaining[0].id)
    }
    setWorkspaceDialog(null)
  }

  return (
    <div
      className={`workbench-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${sidebarResizing ? 'resizing-sidebar' : ''}`}
      style={sidebarCollapsed ? undefined : { gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr)` }}
    >
      <header className="window-titlebar">
        <div className="window-title">
          <span className="window-app-icon"><Boxes size={14} strokeWidth={1.8} /></span>
          <span>{appConfig.title}</span>
        </div>
        <div className="window-controls" aria-label="Window controls">
          <button className="window-control minimize" aria-label="Minimize" onClick={() => Window.Minimise()}><Minus size={16} strokeWidth={2} /></button>
          <button className="window-control maximize" aria-label={maximised ? 'Restore' : 'Maximize'} onClick={toggleMaximise}>{maximised ? <Copy size={13} strokeWidth={1.8} /> : <Square size={13} strokeWidth={1.8} />}</button>
          <button className="window-control close" aria-label="Close" onClick={() => Window.Close()}><X size={17} strokeWidth={2} /></button>
        </div>
      </header>
      <aside className="sidebar">
        {!sidebarCollapsed && (
          <div
            className="sidebar-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onPointerDown={(event) => {
              event.preventDefault()
              setSidebarResizing(true)
            }}
          />
        )}
        <div className="brand-lockup">
          <div className="brand-symbol"><Boxes size={20} strokeWidth={1.8} /></div>
          <div className="brand-copy">
            <strong>{appConfig.title}</strong>
            <span>{appConfig.subtitle}</span>
          </div>
          <button className="sidebar-toggle" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}</button>
        </div>

        <div className="workspace-switcher">
          <button className="workspace-picker" onClick={() => setWorkspaceMenuOpen((open) => !open)} aria-expanded={workspaceMenuOpen}>
            <div className="workspace-copy">
              <small>{appConfig.workspace.label}</small>
              <strong>{activeWorkspace?.name || 'No workspace'}</strong>
            </div>
            <ChevronDown className="chevron" size={16} strokeWidth={1.8} />
          </button>
          {workspaceMenuOpen && (
            <div className="workspace-menu">
              <div className="workspace-menu-heading">WORKSPACES</div>
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  className={`workspace-menu-item ${workspace.id === activeWorkspace?.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveWorkspaceId(workspace.id)
                    setWorkspaceMenuOpen(false)
                  }}
                >
                  <span>{workspace.name}</span>
                  {workspace.id === activeWorkspace?.id && <Check size={14} />}
                </button>
              ))}
              <div className="workspace-menu-actions">
                <button onClick={() => openWorkspaceDialog('create')}><Plus size={14} /> New</button>
                <button onClick={() => openWorkspaceDialog('rename')}><Pencil size={14} /> Rename</button>
                <button onClick={() => openWorkspaceDialog('delete')} disabled={workspaces.length <= 1}><Trash2 size={14} /> Delete</button>
              </div>
            </div>
          )}
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">PROJECT</p>
          {appConfig.navigation.map((item) => (
            <button
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => setView(item.id)}
            >
              <span className="nav-icon">{(() => { const Icon = navigationIcons[item.id]; return <Icon size={17} strokeWidth={1.8} /> })()}</span>
              <span className="nav-text">{item.label}</span>
              {'count' in item && <span className="nav-count">{item.count}</span>}
            </button>
          ))}
          <p className="nav-label nav-label-spaced">TOOLS</p>
          {appConfig.tools.map((tool) => {
            const ToolIcon = tool.label === 'Settings' ? Settings : CircleHelp
            return <button className="nav-item" key={tool.label}><span className="nav-icon"><ToolIcon size={17} strokeWidth={1.8} /></span><span className="nav-text">{tool.label}</span></button>
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="runtime-card">
            <div className="runtime-header">{appConfig.runtime.status}</div>
            <span>{appConfig.runtime.engine}</span>
            <small>{appConfig.runtime.capabilities}</small>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="classic-toolbar">
            <button className="tool-button" title="New experiment"><FilePlus2 size={16} strokeWidth={1.8} /></button>
            <button className="tool-button" title="Open project"><FolderOpen size={16} strokeWidth={1.8} /></button>
            <span className="toolbar-separator" />
            <button className="tool-button" title="Run"><Play size={15} strokeWidth={1.8} /></button>
            <button className="tool-button" title="Stop"><Square size={14} strokeWidth={1.8} /></button>
            <span className="toolbar-separator" />
            <span className="breadcrumbs"><span>Project</span><b>›</b><strong>{appConfig.navigation.find((item) => item.id === view)?.label}</strong></span>
          </div>
          <div className="top-actions">
            <span className="toolbar-status">Ready</span>
            <button className="outline-button" onClick={() => setShowNewExperiment(true)}>New experiment</button>
          </div>
        </header>

        {view === 'overview' && (
          <Overview onStart={startDemoJob} pipeline={pipeline} onNavigate={setView} />
        )}
        {view === 'models' && <Models />}
        {view === 'datasets' && <Datasets />}
        {view === 'experiments' && <Experiments onStart={startDemoJob} pipeline={pipeline} />}
        {view === 'results' && <Results />}
      </main>

      {showNewExperiment && (
        <div className="modal-backdrop" onClick={() => setShowNewExperiment(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><small>NEW WORKFLOW</small><h2>Create experiment</h2></div><button className="close-button" onClick={() => setShowNewExperiment(false)}><X size={17} /></button></div>
            <label>Experiment name<input defaultValue={`${activeWorkspace?.name || 'Workspace'} · Q4 vs Q8`} /></label>
            <label>Base model<select defaultValue="qwen"><option value="qwen">{appConfig.model.name}</option><option>Import another model…</option></select></label>
            <label>Workflow<select defaultValue={workflowOptions[0].value}>{workflowOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <div className="modal-actions"><button className="text-button" onClick={() => setShowNewExperiment(false)}>Cancel</button><button className="primary-button" onClick={() => { setShowNewExperiment(false); setView('experiments') }}>Create experiment <ArrowRight size={15} /></button></div>
          </div>
        </div>
      )}
      {workspaceDialog && (
        <div className="modal-backdrop" onClick={() => setWorkspaceDialog(null)}>
          <div className="modal workspace-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <small>WORKSPACE</small>
                <h2>{workspaceDialog === 'create' ? 'Create workspace' : workspaceDialog === 'rename' ? 'Rename workspace' : 'Delete workspace'}</h2>
              </div>
              <button className="close-button" onClick={() => setWorkspaceDialog(null)}><X size={17} /></button>
            </div>
            {workspaceDialog === 'delete' ? (
              <p className="workspace-delete-copy">Delete <strong>{activeWorkspace?.name}</strong>? This removes the workspace from this app.</p>
            ) : (
              <label>
                Workspace name
                <input autoFocus value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitWorkspaceDialog() }} />
              </label>
            )}
            <div className="modal-actions">
              <button className="text-button" onClick={() => setWorkspaceDialog(null)}>Cancel</button>
              <button className={workspaceDialog === 'delete' ? 'primary-button danger-button' : 'primary-button'} onClick={submitWorkspaceDialog} disabled={workspaceDialog !== 'delete' && !workspaceName.trim()}>
                {workspaceDialog === 'create' ? <><Plus size={15} /> Create</> : workspaceDialog === 'rename' ? <><Pencil size={15} /> Rename</> : <><Trash2 size={15} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>
}

function Overview({ onStart, pipeline, onNavigate }: { onStart: () => void; pipeline: RootState['pipeline']; onNavigate: (view: View) => void }) {
  const stages = appConfig.pipelineStages.map((stage) => stage.title === 'Quantization'
    ? { ...stage, status: pipeline.status === 'running' ? `${pipeline.percent}% running` : stage.status, state: pipeline.status === 'running' ? 'running' : stage.state }
    : stage)
  return <>
    <PageIntro eyebrow="RESEARCH WORKSPACE" title="Good morning, Daniel." description="Run reproducible local-model experiments from one place." action={<button className="primary-button" onClick={onStart}>Run quick evaluation <ArrowRight size={15} /></button>} />
    <section className="hero-card">
      <div className="hero-copy"><span className="pill accent-pill">ACTIVE CASE STUDY</span><h2>{appConfig.study.title}</h2><p>{appConfig.study.description}</p><div className="hero-meta"><span>{appConfig.model.name}</span><span>·</span><span>{appConfig.study.lastRun}</span></div></div>
      <div className="hero-graphic"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="graphic-core"><Boxes size={30} strokeWidth={1.5} /></div><span className="graphic-label label-one">Q4</span><span className="graphic-label label-two">Q8</span><span className="graphic-label label-three">BASE</span></div>
    </section>
    <div className="section-heading"><div><h2>Research pipeline</h2><p>Track each stage from source model to evidence.</p></div><button className="link-button" onClick={() => onNavigate('experiments')}>View experiments <ArrowRight size={14} /></button></div>
    <section className="stage-grid">
      {stages.map(({ number, title, subtitle, status, state }) => <div className={`stage-card ${state}`} key={title}><div className="stage-number">{state === 'complete' ? <Check size={16} strokeWidth={2} /> : number}</div><div className="stage-content"><h3>{title}</h3><span>{subtitle}</span></div><small>{status}</small></div>)}
    </section>
    <div className="dashboard-grid">
      <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent experiments</h2><p>Your latest reproducible runs</p></div><button className="icon-button" aria-label="Experiment menu"><MoreHorizontal size={18} /></button></div>{appConfig.experiments.map((experiment) => <ExperimentRow key={experiment.name} {...experiment} />)}</section>
      <section className="panel snapshot-panel"><div className="panel-heading"><div><h2>Latest result</h2><p>Zero-shot baseline · {appConfig.study.sampleCount} images</p></div><span className="result-badge">{appConfig.study.modelVariant}</span></div><div className="metric-row">{appConfig.metrics.map((metric) => <Metric key={metric.label} {...metric} />)}</div><div className="callout"><span className="callout-icon"><TriangleAlert size={17} /></span><p><strong>Over-calling detected</strong><br />The model flags {appConfig.result.baselineRate} of images positive against a {appConfig.result.observedRate} positive rate.</p></div></section>
    </div>
  </>
}

function ExperimentRow({ name, model, status, metric, tone }: Experiment) {
  return <div className="experiment-row"><div className="experiment-icon"><FlaskConical size={17} strokeWidth={1.8} /></div><div className="experiment-details"><strong>{name}</strong><span>{model}</span></div><span className={`status-label ${tone}`}>{status}</span><strong className="row-metric">{metric}</strong><ArrowRight className="row-arrow" size={16} /></div>
}

function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }

function Models() {
  return <><PageIntro eyebrow="MODEL REGISTRY" title="Models" description="Manage source checkpoints, adapters, and deployment artifacts." action={<button className="primary-button"><Plus size={15} /> Register model</button>} /><section className="card-grid"><div className="resource-card featured"><div className="resource-icon model-icon"><Boxes size={20} strokeWidth={1.7} /></div><div className="resource-card-head"><span className="pill green-pill">READY</span><button className="icon-button" aria-label="Model menu"><MoreHorizontal size={18} /></button></div><h3>{appConfig.model.name}</h3><p>{appConfig.model.summary}</p><div className="resource-tags">{appConfig.model.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="resource-footer"><span>{appConfig.model.variants}</span><span>Updated today</span></div></div><div className="empty-resource"><Plus size={24} /><strong>Register another model</strong><small>Import a checkpoint or GGUF artifact</small></div></section></>
}

function Datasets() {
  return <><PageIntro eyebrow="DATA REGISTRY" title="Datasets" description="Version your data, labels, splits, and lineage." action={<button className="primary-button"><Plus size={15} /> Register dataset</button>} /><section className="table-panel"><div className="panel-heading"><div><h2>Registered datasets</h2><p>Fixed splits preserve reproducibility across experiments.</p></div><div className="search-box"><Search size={15} /><span>Search datasets</span></div></div><div className="data-table"><div className="table-row table-header"><span>Name</span><span>Records</span><span>Split</span><span>Labels</span><span>Version</span></div><div className="table-row"><strong><Database className="table-file" size={15} /> {appConfig.dataset.name}</strong><span>{appConfig.dataset.records}</span><span>{appConfig.dataset.split}</span><span>{appConfig.dataset.labels}</span><span className="version-tag">v1</span></div><div className="table-row"><strong><Database className="table-file" size={15} /> {appConfig.secondaryDataset.name}</strong><span>{appConfig.secondaryDataset.records}</span><span>{appConfig.secondaryDataset.split}</span><span>{appConfig.secondaryDataset.labels}</span><span className="version-tag muted">{appConfig.secondaryDataset.version}</span></div></div></section></>
}

function Experiments({ onStart, pipeline }: { onStart: () => void; pipeline: RootState['pipeline'] }) {
  const experiments = appConfig.experiments.map((experiment) => experiment.name === appConfig.selectedExperiment.name
    ? { ...experiment, status: pipeline.status === 'running' ? 'Running' : experiment.status, tone: pipeline.status === 'running' ? 'running' : experiment.tone }
    : experiment)
  return <><PageIntro eyebrow="EXPERIMENTS" title="Experiments" description="Configure, run, and compare model lifecycle workflows." action={<button className="primary-button" onClick={onStart}><Plus size={15} /> Start experiment</button>} /><div className="experiment-layout"><section className="panel experiment-list"><div className="panel-heading"><div><h2>All experiments</h2><p>{experiments.length} workflows in this workspace</p></div><span className="filter-button">All statuses <ChevronDown size={13} /></span></div>{experiments.map((experiment) => <ExperimentRow key={experiment.name} {...experiment} />)}</section><section className="panel selected-experiment"><span className="pill accent-pill">NEXT UP</span><h2>{appConfig.selectedExperiment.name}</h2><p>{appConfig.selectedExperiment.description}</p><div className="detail-list"><div><span>Source</span><strong>{appConfig.model.name} · F16</strong></div><div><span>Target</span><strong>{appConfig.selectedExperiment.target}</strong></div><div><span>Dataset</span><strong>{appConfig.dataset.name} · test split</strong></div></div><button className="primary-button full-button" onClick={onStart}>Run quantization workflow <ArrowRight size={15} /></button></section></div></>
}

function Results() {
  return <><PageIntro eyebrow="EVIDENCE" title="Results" description="Compare variants and understand where the model succeeds or fails." action={<button className="outline-button"><Download size={15} /> Export report</button>} /><section className="panel result-overview"><div className="panel-heading"><div><h2>Zero-shot baseline</h2><p>{appConfig.model.name} · {appConfig.dataset.name} · {appConfig.study.sampleCount} images</p></div><span className="result-badge">{appConfig.study.modelVariant}</span></div><div className="big-metrics">{[...appConfig.metrics, { label: 'Mean latency', value: appConfig.result.latency }].map((metric) => <Metric key={metric.label} {...metric} />)}</div><div className="chart-placeholder"><div className="chart-grid-lines" /><div className="chart-bars">{appConfig.result.chart.map((height) => <span key={height} style={{ height: `${height}%` }} />)}</div><div className="chart-caption"><span>Baseline metrics overview</span><span>{appConfig.study.sampleCount} images</span></div></div></section></>
}

export default App
