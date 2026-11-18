import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit'

export type PipelineStatus = 'idle' | 'running' | 'completed' | 'failed'

interface PipelineState {
  status: PipelineStatus
  jobId: string | null
  stage: string | null
  percent: number
  message: string
}

const initialState: PipelineState = {
  status: 'idle',
  jobId: null,
  stage: null,
  percent: 0,
  message: '',
}

const pipelineSlice = createSlice({
  name: 'pipeline',
  initialState,
  reducers: {
    jobStarted(
      state,
      action: PayloadAction<{ jobId: string; stage: string }>,
    ) {
      state.status = 'running'
      state.jobId = action.payload.jobId
      state.stage = action.payload.stage
      state.percent = 0
      state.message = ''
    },
    jobProgress(
      state,
      action: PayloadAction<{ stage: string; percent: number }>,
    ) {
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
      return initialState
    },
  },
})

export const {
  jobStarted,
  jobProgress,
  jobCompleted,
  jobFailed,
  resetPipeline,
} = pipelineSlice.actions

export const store = configureStore({
  reducer: {
    pipeline: pipelineSlice.reducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
