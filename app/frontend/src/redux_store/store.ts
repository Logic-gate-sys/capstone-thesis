import { configureStore } from "@reduxjs/toolkit";
import modelsSlice from './slices/models'
import uiSlice from './slices/ui'
import pipelineSlice from './slices/pipeline'
import {
  searchStarted, downloadQueued, workerEventReceived,
  type WorkerEventPayload,
} from './slices/models'
import {
  setView, toggleSidebar, setSidebarWidth, setSidebarResizing,
  setMaximized, setNewExperimentOpen,
} from './slices/ui'
import { jobStarted, jobProgress, jobCompleted, jobFailed } from './slices/pipeline'

export const store = configureStore({
  reducer: {
    models: modelsSlice.reducer,
    ui: uiSlice.reducer,
    pipeline: pipelineSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export {
  searchStarted, downloadQueued, workerEventReceived, type WorkerEventPayload,
  setView, toggleSidebar, setSidebarWidth, setSidebarResizing,
  setMaximized, setNewExperimentOpen,
  jobStarted, jobProgress, jobCompleted, jobFailed,
}