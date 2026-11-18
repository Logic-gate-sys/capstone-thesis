import { useEffect, type ReactNode } from 'react'
import { Window } from '@wailsio/runtime'
import {
  ArrowRight, Boxes, ChartNoAxesColumnIncreasing, Check, ChevronDown,
  CircleHelp, Copy, Database, FilePlus2, FlaskConical, FolderOpen,
  LayoutDashboard, Minus, PanelLeftClose, PanelLeftOpen, Pencil, Plus,
  Settings, Square, Trash2, X, Play,
} from 'lucide-react'
import { appConfig, type View, workflowOptions } from '../config'
import { useAppDispatch, useAppSelector } from '../hooks'
import {
  closeWorkspaceDialog, closeWorkspaceMenu, createWorkspace,
  deleteActiveWorkspace, openWorkspaceDialog, renameWorkspace,
  setMaximized, setNewExperimentOpen, setSidebarResizing, setSidebarWidth,
  setView, setWorkspaceName, switchWorkspace, toggleSidebar, toggleWorkspaceMenu,
} from '../store'

const navigationIcons = {
  overview: LayoutDashboard,
  models: Boxes,
  datasets: Database,
  experiments: FlaskConical,
  results: ChartNoAxesColumnIncreasing,
}

export function LayoutShell({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const ui = useAppSelector((state) => state.ui)
  const workspaceState = useAppSelector((state) => state.workspaces)
  const activeWorkspace = workspaceState.items.find((workspace) => workspace.id === workspaceState.activeId) || workspaceState.items[0]

  useEffect(() => {
    if (!ui.sidebarResizing) return
    const handlePointerMove = (event: PointerEvent) => {
      const maximum = Math.floor(window.innerWidth / 3)
      dispatch(setSidebarWidth(Math.min(maximum, Math.max(220, event.clientX))))
    }
    const stopResizing = () => dispatch(setSidebarResizing(false))
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
    }
  }, [dispatch, ui.sidebarResizing])

  const toggleMaximise = async () => {
    await Window.ToggleMaximise()
    dispatch(setMaximized(await Window.IsMaximised()))
  }

  const openDialog = (dialog: 'create' | 'rename' | 'delete') => {
    dispatch(setWorkspaceName(dialog === 'rename' ? activeWorkspace?.name || '' : ''))
    dispatch(openWorkspaceDialog(dialog))
  }

  const submitWorkspaceDialog = () => {
    if (ui.workspaceDialog === 'create') {
      const name = ui.workspaceName.trim()
      if (!name) return
      const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'}-${Date.now()}`
      dispatch(createWorkspace({ id, name }))
    } else if (ui.workspaceDialog === 'rename') {
      const name = ui.workspaceName.trim()
      if (name) dispatch(renameWorkspace(name))
    } else if (ui.workspaceDialog === 'delete') {
      dispatch(deleteActiveWorkspace())
    }
    dispatch(closeWorkspaceDialog())
  }

  const shellStyle = ui.sidebarCollapsed
    ? undefined
    : { gridTemplateColumns: `${ui.sidebarWidth}px minmax(0, 1fr)` }

  return (
    <div className={`workbench-shell ${ui.sidebarCollapsed ? 'sidebar-collapsed' : ''} ${ui.sidebarResizing ? 'resizing-sidebar' : ''}`} style={shellStyle}>
      <header className="window-titlebar">
        <div className="window-title">
          <span className="window-app-icon"><Boxes size={14} strokeWidth={1.8} /></span>
          <span>{appConfig.title}</span>
        </div>
        <div className="window-controls" aria-label="Window controls">
          <button className="window-control minimize" aria-label="Minimize" onClick={() => Window.Minimise()}><Minus size={16} strokeWidth={2} /></button>
          <button className="window-control maximize" aria-label={ui.maximised ? 'Restore' : 'Maximize'} onClick={toggleMaximise}>{ui.maximised ? <Copy size={13} strokeWidth={1.8} /> : <Square size={13} strokeWidth={1.8} />}</button>
          <button className="window-control close" aria-label="Close" onClick={() => Window.Close()}><X size={17} strokeWidth={2} /></button>
        </div>
      </header>

      <aside className="sidebar">
        {!ui.sidebarCollapsed && (
          <div className="sidebar-resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" onPointerDown={(event) => { event.preventDefault(); dispatch(setSidebarResizing(true)) }} />
        )}
        <div className="brand-lockup">
          <div className="brand-symbol"><Boxes size={20} strokeWidth={1.8} /></div>
          <div className="brand-copy"><strong>{appConfig.title}</strong><span>{appConfig.subtitle}</span></div>
          <button className="sidebar-toggle" aria-label={ui.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => dispatch(toggleSidebar())}>{ui.sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}</button>
        </div>

        <div className="workspace-switcher">
          <button className="workspace-picker" onClick={() => dispatch(toggleWorkspaceMenu())} aria-expanded={ui.workspaceMenuOpen}>
            <div className="workspace-copy"><small>{appConfig.workspace.label}</small><strong>{activeWorkspace?.name || 'No workspace'}</strong></div>
            <ChevronDown className="chevron" size={16} strokeWidth={1.8} />
          </button>
          {ui.workspaceMenuOpen && (
            <div className="workspace-menu">
              <div className="workspace-menu-heading">WORKSPACES</div>
              {workspaceState.items.map((workspace) => (
                <button key={workspace.id} className={`workspace-menu-item ${workspace.id === activeWorkspace?.id ? 'active' : ''}`} onClick={() => { dispatch(switchWorkspace(workspace.id)); dispatch(closeWorkspaceMenu()) }}>
                  <span>{workspace.name}</span>{workspace.id === activeWorkspace?.id && <Check size={14} />}
                </button>
              ))}
              <div className="workspace-menu-actions">
                <button onClick={() => openDialog('create')}><Plus size={14} /> New</button>
                <button onClick={() => openDialog('rename')}><Pencil size={14} /> Rename</button>
                <button onClick={() => openDialog('delete')} disabled={workspaceState.items.length <= 1}><Trash2 size={14} /> Delete</button>
              </div>
            </div>
          )}
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">PROJECT</p>
          {appConfig.navigation.map((item) => {
            const Icon = navigationIcons[item.id as View]
            return (
              <button className={`nav-item ${ui.view === item.id ? 'active' : ''}`} key={item.id} onClick={() => dispatch(setView(item.id as View))}>
                <span className="nav-icon"><Icon size={17} strokeWidth={1.8} /></span>
                <span className="nav-text">{item.label}</span>
                {'count' in item && <span className="nav-count">{item.count}</span>}
              </button>
            )
          })}
          <p className="nav-label nav-label-spaced">TOOLS</p>
          {appConfig.tools.map((tool) => {
            const ToolIcon = tool.label === 'Settings' ? Settings : CircleHelp
            return <button className="nav-item" key={tool.label}><span className="nav-icon"><ToolIcon size={17} strokeWidth={1.8} /></span><span className="nav-text">{tool.label}</span></button>
          })}
        </nav>

        <div className="sidebar-footer"><div className="runtime-card"><div className="runtime-header">{appConfig.runtime.status}</div><span>{appConfig.runtime.engine}</span><small>{appConfig.runtime.capabilities}</small></div></div>
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
            <span className="breadcrumbs"><span>Project</span><b>›</b><strong>{appConfig.navigation.find((item) => item.id === ui.view)?.label}</strong></span>
          </div>
          <div className="top-actions"><span className="toolbar-status">Ready</span><button className="outline-button" onClick={() => dispatch(setNewExperimentOpen(true))}>New experiment</button></div>
        </header>
        {children}
      </main>

      {ui.newExperimentOpen && (
        <div className="modal-backdrop" onClick={() => dispatch(setNewExperimentOpen(false))}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><small>NEW WORKFLOW</small><h2>Create experiment</h2></div><button className="close-button" onClick={() => dispatch(setNewExperimentOpen(false))}><X size={17} /></button></div>
            <label>Experiment name<input defaultValue={`${activeWorkspace?.name || 'Workspace'} · Q4 vs Q8`} /></label>
            <label>Base model<select defaultValue="qwen"><option value="qwen">{appConfig.model.name}</option><option>Import another model…</option></select></label>
            <label>Workflow<select defaultValue={workflowOptions[0].value}>{workflowOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <div className="modal-actions"><button className="text-button" onClick={() => dispatch(setNewExperimentOpen(false))}>Cancel</button><button className="primary-button" onClick={() => { dispatch(setNewExperimentOpen(false)); dispatch(setView('experiments')) }}>Create experiment <ArrowRight size={15} /></button></div>
          </div>
        </div>
      )}

      {ui.workspaceDialog && (
        <div className="modal-backdrop" onClick={() => dispatch(closeWorkspaceDialog())}>
          <div className="modal workspace-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><small>WORKSPACE</small><h2>{ui.workspaceDialog === 'create' ? 'Create workspace' : ui.workspaceDialog === 'rename' ? 'Rename workspace' : 'Delete workspace'}</h2></div><button className="close-button" onClick={() => dispatch(closeWorkspaceDialog())}><X size={17} /></button></div>
            {ui.workspaceDialog === 'delete' ? (
              <p className="workspace-delete-copy">Delete <strong>{activeWorkspace?.name}</strong>? This removes the workspace from this app.</p>
            ) : (
              <label>Workspace name<input autoFocus value={ui.workspaceName} onChange={(event) => dispatch(setWorkspaceName(event.target.value))} onKeyDown={(event) => { if (event.key === 'Enter') submitWorkspaceDialog() }} /></label>
            )}
            <div className="modal-actions">
              <button className="text-button" onClick={() => dispatch(closeWorkspaceDialog())}>Cancel</button>
              <button className={ui.workspaceDialog === 'delete' ? 'primary-button danger-button' : 'primary-button'} onClick={submitWorkspaceDialog} disabled={ui.workspaceDialog !== 'delete' && !ui.workspaceName.trim()}>
                {ui.workspaceDialog === 'create' ? <><Plus size={15} /> Create</> : ui.workspaceDialog === 'rename' ? <><Pencil size={15} /> Rename</> : <><Trash2 size={15} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
