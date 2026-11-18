import { LayoutShell } from './components/LayoutShell'
import { useAppSelector } from './hooks'
import { DatasetsPage } from './pages/DatasetsPage'
import { ExperimentsPage } from './pages/ExperimentsPage'
import { ModelsPage } from './pages/ModelsPage'
import { OverviewPage } from './pages/OverviewPage'
import { ResultsPage } from './pages/ResultsPage'

function App() {
  const view = useAppSelector((state) => state.ui.view)

  return (
    <LayoutShell>
      {view === 'overview' && <OverviewPage />}
      {view === 'models' && <ModelsPage />}
      {view === 'datasets' && <DatasetsPage />}
      {view === 'experiments' && <ExperimentsPage />}
      {view === 'results' && <ResultsPage />}
    </LayoutShell>
  )
}

export default App
