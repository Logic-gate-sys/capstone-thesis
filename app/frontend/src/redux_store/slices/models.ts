import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface ModelSearchResult {
  repo_id: string;
  pipeline_tag?: string | null;
  library_name?: string | null;
  downloads?: number | null;
  likes?: number | null;
  tags?: string[];
}

export interface DownloadJobState {
  jobId: string;
  repoId: string;
  status: "idle" | "downloading" | "completed" | "failed";
  progress: number; // 0–100 if emitted by worker
  message?: string;
  artifactPath?: string;
  checksum?: string;
  error?: string;
}

export interface WorkerEventPayload {
  event: "ready" | "search_results" | "progress" | "artifact" | "complete" | "error" | "log";
  job_id?: string;
  models?: ModelSearchResult[];
  percent?: number;
  progress?: number;
  message?: string;
  path?: string;
  artifact_type?: string;
  checksum?: string;
  status?: string;
  repo_id?: string;
}

interface ModelsState {
  searchJobId: string | null;
  isSearching: boolean;
  searchResults: ModelSearchResult[];
  searchError: string | null;
  downloadsByJobId: Record<string, DownloadJobState>;
}

const initialState: ModelsState = {
  searchJobId: null,
  isSearching: false,
  searchResults: [],
  searchError: null,
  downloadsByJobId: {},
};

const modelsSlice = createSlice({
  name: "models",
  initialState,
  reducers: {
    searchStarted(state, action: PayloadAction<{ jobId: string }>) {
      state.searchJobId = action.payload.jobId;
      state.isSearching = true;
      state.searchError = null;
    },
    downloadQueued(state, action: PayloadAction<{ jobId: string; repoId: string }>) {
      state.downloadsByJobId[action.payload.jobId] = {
        jobId: action.payload.jobId,
        repoId: action.payload.repoId,
        status: "downloading",
        progress: 0,
      };
    },
    workerEventReceived(state, action: PayloadAction<WorkerEventPayload>) {
      const ev = action.payload;
      const jobId = ev.job_id ?? "";

      switch (ev.event) {
        case "search_results": {
          if (!state.searchJobId || jobId === state.searchJobId) {
            state.searchResults = ev.models ?? [];
            state.isSearching = false;
          }
          break;
        }
        case "progress": {
          const dl = state.downloadsByJobId[jobId];
          if (dl) {
            const pct = ev.percent ?? ev.progress ?? dl.progress;
            dl.progress = Math.max(0, Math.min(100, pct));
            if (ev.message) {
              dl.message = ev.message;
            }
          }
          break;
        }
        case "artifact": {
          const dl = state.downloadsByJobId[jobId];
          if (dl) {
            if (ev.path) dl.artifactPath = ev.path;
            if (ev.checksum) dl.checksum = ev.checksum;
          }
          break;
        }
        case "complete": {
          if (jobId === state.searchJobId) {
            state.isSearching = false;
          }
          const dl = state.downloadsByJobId[jobId];
          if (dl) {
            dl.status = ev.status === "success" ? "completed" : "failed";
            if (dl.status === "completed") {
              dl.progress = 100;
            }
          }
          break;
        }
        case "error": {
          if (jobId === state.searchJobId) {
            state.isSearching = false;
            state.searchError = ev.message ?? "Model search failed";
          }
          const dl = state.downloadsByJobId[jobId];
          if (dl) {
            dl.status = "failed";
            dl.error = ev.message ?? "Download failed";
          }
          break;
        }
      }
    },
  },
});

export const { searchStarted, downloadQueued, workerEventReceived } = modelsSlice.actions;
export default modelsSlice

