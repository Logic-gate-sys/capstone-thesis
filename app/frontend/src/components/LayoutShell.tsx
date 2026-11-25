import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { Window } from '@wailsio/runtime'
import {BarChart3, Boxes, CircleHelp, Database, FlaskConical, LayoutDashboard, PanelLeftClose, PanelLeftOpen,
  Plus, Settings, X} from 'lucide-react'
import { appConfig, type View } from '../config'
import { useAppDispatch, useAppSelector } from '../hooks'
import { setMaximized, setNewExperimentOpen, setSidebarResizing, setSidebarWidth, setView, toggleSidebar } from '../redux_store/store'

const icons = {
  overview: LayoutDashboard,
  models: Boxes,
  datasets: Database,
  experiments: FlaskConical,
  results: BarChart3,
}

export function LayoutShell({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const view = useAppSelector((state) => state.ui.view)
  const newExperimentOpen = useAppSelector((state) => state.ui.newExperimentOpen)
  const sidebarCollapsed = useAppSelector((state) => state.ui.sidebarCollapsed)
  const sidebarWidth = useAppSelector((state) => state.ui.sidebarWidth)
  const sidebarResizing = useAppSelector((state) => state.ui.sidebarResizing)
  const maximised = useAppSelector((state) => state.ui.maximised)

  const toggleMaximise = async () => {
    await Window.ToggleMaximise()
    dispatch(setMaximized(await Window.IsMaximised()))
  }

  useEffect(() => {
    if (!sidebarResizing) return
    const resize = (event: PointerEvent) => {
      dispatch(setSidebarWidth(Math.min(300, Math.max(160, event.clientX - 12))))
    }
    const stop = () => dispatch(setSidebarResizing(false))
    window.addEventListener('pointermove', resize)
    window.addEventListener('pointerup', stop)
    return () => {
      window.removeEventListener('pointermove', resize)
      window.removeEventListener('pointerup', stop)
    }
  }, [dispatch, sidebarResizing])

  const contentColumns = sidebarCollapsed ? '72px 1fr' : `${sidebarWidth}px 1fr`

  return (
    <div className="h-screen min-h-[720px] min-w-[980px] overflow-hidden bg-[#eef0f4] p-[10px] text-[#25283a]">
      <div className="grid h-full w-full grid-rows-[44px_1fr] overflow-hidden rounded-[24px] border border-[#d9dde6] bg-[#f7f8fa] shadow-[0_24px_70px_rgba(37,40,58,.16),0_2px_0_rgba(255,255,255,.95)_inset,0_-1px_0_rgba(37,40,58,.04)_inset]">
        <header className="flex h-[44px] items-center justify-between border-b border-[#dfe3eb] bg-[linear-gradient(180deg,#fff,#f7f8fa)] px-5 py-1.5 shadow-[0_1px_0_rgba(255,255,255,.95)_inset,0_-1px_0_rgba(37,40,58,.03)_inset]" style={{ WebkitAppRegion: 'drag' } as CSSProperties}>
          <div className="flex items-center gap-3 font-bold">
            <div className="grid size-8 place-items-center rounded-[10px] bg-[#25283a] shadow-[0_4px_10px_rgba(37,40,58,.16),0_1px_0_rgba(255,255,255,.12)_inset]"><Boxes size={18} className="text-white" /></div>
            <span className="text-[15px] font-bold tracking-[.01em]">{appConfig.title}</span>
          </div>
          <div className="flex items-center gap-0.5 pr-1" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
            <button title="Minimize" onClick={() => Window.Minimise()} className="grid size-10 place-items-center text-[#969dac] hover:bg-[#f1f3f6]"><span className="mb-1 h-[2px] w-4 bg-current" /></button>
            <button title={maximised ? 'Restore' : 'Maximize'} onClick={toggleMaximise} className="grid size-10 place-items-center text-[#969dac] hover:bg-[#f1f3f6]"><span className="size-4 rounded-[3px] border-2 border-current" /></button>
            <button title="Close" onClick={() => Window.Close()} className="grid size-10 place-items-center text-[#969dac] hover:bg-[#f1f3f6] hover:text-[#d95a60]"><X size={19} strokeWidth={2} /></button>
          </div>
        </header>

        <div className={`grid min-h-0 ${sidebarResizing ? 'select-none' : ''}`} style={{ gridTemplateColumns: contentColumns }}>
          <aside className="relative flex min-h-0 flex-col items-center border-r border-[#dfe3eb] bg-[linear-gradient(90deg,#fff,#f8f9fb)] py-5 shadow-[1px_0_0_rgba(255,255,255,.9)_inset,6px_0_18px_rgba(37,40,58,.025)]">
            {!sidebarResizing && <div className="mb-8 h-px" />}
            {!sidebarCollapsed && (
              <button
                onPointerDown={(event) => { event.preventDefault(); dispatch(setSidebarResizing(true)) }}
                title="Drag to resize sidebar"
                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[#25283a]/10"
                aria-label="Resize sidebar"
              />
            )}
            <nav className={`flex w-full flex-col gap-2 ${sidebarCollapsed ? 'items-center' : 'px-3'}`} aria-label="Main navigation">
              {appConfig.navigation.map((item) => {
                const Icon = icons[item.id as View]
                const active = view === item.id
                return (
                  <button
                    key={item.id}
                    title={item.label}
                    onClick={() => dispatch(setView(item.id as View))}
                    className={`flex items-center rounded-2xl transition ${sidebarCollapsed ? 'size-12 justify-center' : 'h-12 w-full gap-3 px-3'} ${active ? 'bg-[#f1f3f6] text-[#25283a] shadow-[0_6px_18px_rgba(37,40,58,.07)]' : 'text-[#aab1c1] hover:bg-[#f6f7f9] hover:text-[#697187]'}`}
                  >
                    <Icon size={20} strokeWidth={1.8} />
                    {!sidebarCollapsed && <span className="text-[12px] font-bold">{item.label}</span>}
                    {!sidebarCollapsed && 'count' in item && <span className="ml-auto rounded-full bg-[#25283a] px-2 py-0.5 text-[8px] text-white">{item.count}</span>}
                  </button>
                )
              })}
            </nav>
            <button
              onClick={() => dispatch(toggleSidebar())}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`absolute top-5 ${sidebarCollapsed ? '-right-4' : 'right-3'} z-10 grid size-8 place-items-center rounded-full border border-[#edf0f4] bg-white text-[#aab1c1] shadow-[0_5px_16px_rgba(37,40,58,.10)]`}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </button>
            <div className={`mt-auto flex flex-col gap-2 ${sidebarCollapsed ? 'items-center' : 'w-full px-3'}`}>
              <button title="Settings" className={`${sidebarCollapsed ? 'grid size-12 place-items-center' : 'flex h-12 w-full items-center gap-3 px-3'} rounded-2xl text-[#b4bac8] hover:bg-[#f3f5f8]`}><Settings size={20} strokeWidth={1.7} />{!sidebarCollapsed && <span className="text-[12px] font-bold">Settings</span>}</button>
              <button title="Help" className={`${sidebarCollapsed ? 'grid size-12 place-items-center' : 'flex h-12 w-full items-center gap-3 px-3'} rounded-2xl text-[#b4bac8] hover:bg-[#f3f5f8]`}><CircleHelp size={20} strokeWidth={1.7} />{!sidebarCollapsed && <span className="text-[12px] font-bold">Help</span>}</button>
            </div>
          </aside>

          <main className="min-w-0 overflow-y-auto px-6 py-7 2xl:px-10">
            {children}
          </main>
        </div>
        {newExperimentOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-[#25283a]/20 backdrop-blur-sm" onClick={() => dispatch(setNewExperimentOpen(false))}>
            <div className="w-[440px] rounded-[24px] bg-white p-6 shadow-[0_24px_70px_rgba(34,39,56,.20)]" onClick={(event) => event.stopPropagation()}>
              <div className="mb-6 flex items-start justify-between">
                <div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#abb2c1]">New workflow</p><h2 className="mt-1 text-[16px] font-bold">Create experiment</h2></div>
                <button title="Close" onClick={() => dispatch(setNewExperimentOpen(false))} className="grid size-8 place-items-center rounded-full text-[#abb2c1] hover:bg-[#f3f5f7]"><X size={16} /></button>
              </div>
              <label className="block text-[10px] font-bold">Experiment name<input className="mt-2 h-11 w-full rounded-xl border border-[#edf0f4] px-3 text-[11px] outline-none focus:border-[#aab1c1]" defaultValue="Wound triage · Q4 vs Q8" /></label>
              <label className="mt-4 block text-[10px] font-bold">Base model<select className="mt-2 h-11 w-full rounded-xl border border-[#edf0f4] px-3 text-[11px] outline-none"><option>{appConfig.model.name}</option></select></label>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => dispatch(setNewExperimentOpen(false))} className="h-10 rounded-full px-4 text-[10px] font-bold">Cancel</button>
                <button onClick={() => { dispatch(setNewExperimentOpen(false)); dispatch(setView('experiments')) }} className="flex h-10 items-center gap-2 rounded-full bg-[#25283a] px-5 text-[10px] font-bold text-white"><Plus size={14} /> Create experiment</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
