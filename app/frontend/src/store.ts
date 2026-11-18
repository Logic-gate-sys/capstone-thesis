import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { appConfig, type View, type Workspace } from './config'

export type PipelineStatus = 'idle' | 'running' | 'completed' | 'failed'

interface PipelineState {
  status: PipelineStatus
  jobId: string | null
  stage: string | null
  percent: number
  message: string
}

const initialPipelineState: PipelineState = {
  status: 'idle',
  jobId: null,
  stage: null,
  percent: 0,
  message: '',
}

const pipelineSlice = createSlice({
  name: 'pipeline',
  initialState: initialPipelineState,
  reducers: {
    jobStarted(state, action: PayloadAction<{ jobId: string; stage: string }>) {
      state.status = 'running'
      state.jobId = action.payload.jobId
      state.stage = action.payload.stage
      state.percent = 0
      state.message = ''
    },
    jobProgress(state, action: PayloadAction<{ stage: string; percent: number }>) {
      state.status = 'running'
      state.stage = action.payload.stage
      state.percent = action.payload.percent
    },
    jobCompleted(state) {
      state.status = 'completed'
      state.percent = 100
    },
    jobFailed(state, action: PayloadAction<string>) {
      state.status = 'failed'
      state.message = action.payload
    },
    resetPipeline() {
      return initialPipelineState
    },
  },
})

function loadWorkspaces(): Workspace[] {
  try {
    const saved = localStorage.getItem('ml-workbench-workspaces')
    const parsed = saved ? JSON.parse(saved) as Workspace[] : null
    return parsed && parsed.length > 0 ? parsed : [...appConfig.workspaces]
  } catch {
    return [...appConfig.workspaces]
  }
}

interface WorkspaceState {
  items: Workspace[]
  activeId: string
}

const initialWorkspaceState: WorkspaceState = {
  items: loadWorkspaces(),
  activeId: localStorage.getItem('ml-workbench-active-workspace') || 'wound-triage',
}

const workspaceSlice = createSlice({
  name: 'workspaces',
  initialState: initialWorkspaceState,
  reducers: {
    switchWorkspace(state, action: PayloadAction<string>) {
      if (state.items.some((workspace) => workspace.id === action.payload)) {
        state.activeId = action.payload
        localStorage.setItem('ml-workbench-active-workspace', action.payload)
      }
    },
    createWorkspace(state, action: PayloadAction<{ id: string; name: string }>) {
      state.items.push(action.payload)
      state.activeId = action.payload.id
      localStorage.setItem('ml-workbench-workspaces', JSON.stringify(state.items))
      localStorage.setItem('ml-workbench-active-workspace', state.activeId)
    },
    renameWorkspace(state, action: PayloadAction<string>) {
      const active = state.items.find((workspace) => workspace.id === state.activeId)
      if (active) {
        active.name = action.payload
        localStorage.setItem('ml-workbench-workspaces', JSON.stringify(state.items))
      }
    },
    deleteActiveWorkspace(state) {
      if (state.items.length <= 1) return
      state.items = state.items.filter((workspace) => workspace.id !== state.activeId)
      state.activeId = state.items[0].id
      localStorage.setItem('ml-workbench-workspaces', JSON.stringify(state.items))
      localStorage.setItem('ml-workbench-active-workspace', state.activeId)
    },
  },
})

type WorkspaceDialog = 'create' | 'rename' | 'delete' | null

interface UiState {
  view: View
  sidebarCollapsed: boolean
  sidebarWidth: number
  sidebarResizing: boolean
  maximised: boolean
  workspaceMenuOpen: boolean
  workspaceDialog: WorkspaceDialog
  workspaceName: string
  newExperimentOpen: boolean
}

const initialUiState: UiState = {
  view: 'overview',
  sidebarCollapsed: false,
  sidebarWidth: 248,
  sidebarResizing: false,
  maximised: false,
  workspaceMenuOpen: false,
  workspaceDialog: null,
  workspaceName: '',
  newExperimentOpen: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUiState,
  reducers: {
    setView(state, action: PayloadAction<View>) { state.view = action.payload },
    toggleSidebar(state) { state.sidebarCollapsed = !state.sidebarCollapsed },
    setSidebarWidth(state, action: PayloadAction<number>) { state.sidebarWidth = action.payload },
    setSidebarResizing(state, action: PayloadAction<boolean>) { state.sidebarResizing = action.payload },
    setMaximized(state, action: PayloadAction<boolean>) { state.maximised = action.payload },
    toggleWorkspaceMenu(state) { state.workspaceMenuOpen = !state.workspaceMenuOpen },
    closeWorkspaceMenu(state) { state.workspaceMenuOpen = false },
    openWorkspaceDialog(state, action: PayloadAction<Exclude<WorkspaceDialog, null>>) {
      state.workspaceMenuOpen = false
      state.workspaceDialog = action.payload
    },
    setWorkspaceName(state, action: PayloadAction<string>) { state.workspaceName = action.payload },
    closeWorkspaceDialog(state) { state.workspaceDialog = null },
    setNewExperimentOpen(state, action: PayloadAction<boolean>) { state.newExperimentOpen = action.payload },
  },
})

export const {
  jobStarted, jobProgress, jobCompleted, jobFailed, resetPipeline,
} = pipelineSlice.actions

export const {
  switchWorkspace, createWorkspace, renameWorkspace, deleteActiveWorkspace,
} = workspaceSlice.actions

export const {
  setView, toggleSidebar, setSidebarWidth, setSidebarResizing, setMaximized,
  toggleWorkspaceMenu, closeWorkspaceMenu, openWorkspaceDialog,
  setWorkspaceName, closeWorkspaceDialog, setNewExperimentOpen,
} = uiSlice.actions

export const store = configureStore({
  reducer: {
    pipeline: pipelineSlice.reducer,
    workspaces: workspaceSlice.reducer,
    ui: uiSlice.reducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
