import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

interface PipelineState {
  status: "idle" | "running" | "completed" | "failed"
  jobId: string | null
  stage: string | null
  percent: number
  message: string
}

const initialState: PipelineState = {
  status: "idle",
  jobId: null,
  stage: null,
  percent: 0,
  message: "",
}

const pipelineSlice = createSlice({
  name: "pipeline",
  initialState,
  reducers: {
    jobStarted(state, action: PayloadAction<{ jobId: string; stage: string }>) {
      state.status = "running"
      state.jobId = action.payload.jobId
      state.stage = action.payload.stage
      state.percent = 0
    },
    jobProgress(state, action: PayloadAction<{ stage: string; percent: number }>) {
      state.status = "running"
      state.stage = action.payload.stage
      state.percent = action.payload.percent
    },
    jobCompleted(state) { state.status = "completed"; state.percent = 100 },
    jobFailed(state, action: PayloadAction<string>) { state.status = "failed"; state.message = action.payload },
  },
})

export const { jobStarted, jobProgress, jobCompleted, jobFailed } = pipelineSlice.actions
export default pipelineSlice
