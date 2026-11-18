export type View = 'overview' | 'models' | 'datasets' | 'experiments' | 'results'

export interface NavigationItem {
  id: View
  label: string
  icon: string
  count?: number
}

export interface Experiment {
  name: string
  model: string
  status: string
  metric: string
  tone: string
}

export interface Workspace {
  id: string
  name: string
}

export const appConfig = {
  title: 'ML Workbench',
  subtitle: 'Local model research',
  workspace: {
    label: 'WORKSPACE',
    name: 'Wound triage study',
  },
  workspaces: [
    { id: 'wound-triage', name: 'Wound triage study' },
    { id: 'comparative-study', name: 'Comparative study' },
  ] satisfies Workspace[],
  runtime: {
    status: 'Runtime ready',
    engine: 'llama.cpp · CPU',
    capabilities: 'Q4 / Q8 supported',
  },
  navigation: [
    { id: 'overview', label: 'Overview', icon: '⌂' },
    { id: 'models', label: 'Models', icon: '◈' },
    { id: 'datasets', label: 'Datasets', icon: '▦' },
    { id: 'experiments', label: 'Experiments', icon: '⌁', count: 3 },
    { id: 'results', label: 'Results', icon: '◌' },
  ] satisfies NavigationItem[],
  tools: [
    { label: 'Settings', icon: '⚙' },
    { label: 'Documentation', icon: '?' },
  ],
  pipelineStages: [
    { number: '01', title: 'Dataset', subtitle: 'SurgWound · 686 images', status: 'Ready', state: 'complete' },
    { number: '02', title: 'Baseline', subtitle: 'Qwen3-VL · F16', status: 'Complete', state: 'complete' },
    { number: '03', title: 'Adaptation', subtitle: 'LoRA fine-tuning', status: 'Not started', state: 'pending' },
    { number: '04', title: 'Quantization', subtitle: 'Q4_K_M · Q8_0', status: 'Ready to run', state: 'ready' },
    { number: '05', title: 'Evaluation', subtitle: 'Compare all variants', status: 'Pending inputs', state: 'pending' },
  ],
  experiments: [
    { name: 'Zero-shot baseline', model: 'Qwen3-VL-4B · F16', status: 'Complete', metric: '75.0%', tone: 'success' },
    { name: 'Q4 quantization check', model: 'Qwen3-VL-4B · Q4_K_M', status: 'Ready', metric: '—', tone: 'neutral' },
    { name: 'Q8 quantization check', model: 'Qwen3-VL-4B · Q8_0', status: 'Ready', metric: '—', tone: 'neutral' },
  ] satisfies Experiment[],
  model: {
    name: 'Qwen3-VL-4B-Instruct',
    summary: 'Vision-language model · 4B parameters',
    tags: ['Hugging Face', 'GGUF', 'Q4 · Q8'],
    variants: '2 variants registered',
  },
  dataset: {
    name: 'SurgWound',
    records: '686 images',
    split: '70 / 15 / 15',
    labels: '3 classes',
  },
  secondaryDataset: {
    name: 'DFUC2021',
    records: '—',
    split: 'Not configured',
    labels: '4 classes',
    version: 'Draft',
  },
  study: {
    title: 'Wound-infection triage',
    description: 'Measure how adaptation and quantization affect reliability for offline VLM inference.',
    modelVariant: 'F16',
    sampleCount: 120,
    lastRun: 'Last run 2 hours ago',
  },
  selectedExperiment: {
    name: 'Q4 quantization check',
    target: 'Q4_K_M GGUF',
    description: 'Create a Q4_K_M artifact from the registered F16 source and measure its effect on performance.',
  },
  result: {
    baselineRate: '39.2%',
    observedRate: '15.8%',
    latency: '2.13s',
    chart: [48, 72, 61, 86, 68, 94, 78],
  },
  metrics: [
    { label: 'Accuracy', value: '75.0%' },
    { label: 'Sensitivity', value: '94.7%' },
    { label: 'Specificity', value: '71.3%' },
  ],
} as const

export const workflowOptions = [
  { value: 'full', label: 'Adapt → Convert → Quantize → Evaluate' },
  { value: 'baseline', label: 'Baseline evaluation only' },
  { value: 'comparison', label: 'Quantization comparison' },
]
