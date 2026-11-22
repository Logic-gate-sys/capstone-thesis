import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { View } from "../../config"

interface UiState {
  view: View
  sidebarCollapsed: boolean
  sidebarWidth: number
  sidebarResizing: boolean
  maximised: boolean
  newExperimentOpen: boolean
}

const initialState: UiState = {
  view: "overview",
  sidebarCollapsed: false,
  sidebarWidth: 220,
  sidebarResizing: false,
  maximised: false,
  newExperimentOpen: false,
}

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setView(state, action: PayloadAction<View>) { state.view = action.payload },
    toggleSidebar(state) { state.sidebarCollapsed = !state.sidebarCollapsed },
    setSidebarWidth(state, action: PayloadAction<number>) { state.sidebarWidth = action.payload },
    setSidebarResizing(state, action: PayloadAction<boolean>) { state.sidebarResizing = action.payload },
    setMaximized(state, action: PayloadAction<boolean>) { state.maximised = action.payload },
    setNewExperimentOpen(state, action: PayloadAction<boolean>) { state.newExperimentOpen = action.payload },
  },
})

export const {
  setView, toggleSidebar, setSidebarWidth, setSidebarResizing,
  setMaximized, setNewExperimentOpen,
} = uiSlice.actions
export default uiSlice
