import { Boxes, Database, FlaskConical, Gauge, Plus } from 'lucide-react'
import { appConfig } from '../config'
import { useAppDispatch, useAppSelector } from '../hooks'
import { setNewExperimentOpen, setView } from '../store'

const stages = [
  { icon: Database, label: 'Dataset', sub: '686 images', state: 'Ready' },
  { icon: Boxes, label: 'Baseline', sub: 'F16 model', state: 'Complete' },
  { icon: FlaskConical, label: 'Adaptation', sub: 'LoRA', state: 'Not started' },
  { icon: Gauge, label: 'Quantization', sub: 'Q4 / Q8', state: 'Ready' },
]

function Toggle({ on = true }: { on?: boolean }) {
  return <button className={`relative h-7 w-12 rounded-full border border-[#d7dce5] transition ${on ? 'bg-[#25283a] shadow-[0_3px_8px_rgba(37,40,58,.18),0_1px_0_rgba(255,255,255,.12)_inset]' : 'bg-[#e7eaf0] shadow-[0_2px_5px_rgba(37,40,58,.08)_inset]'}`}><span className={`absolute top-1 size-5 rounded-full border border-[#dfe3ea] bg-white shadow-[0_3px_7px_rgba(37,40,58,.18),0_1px_0_rgba(255,255,255,.95)_inset] ${on ? 'right-1' : 'left-1'}`} /></button>
}

export function OverviewPage() {
  const dispatch = useAppDispatch()
  const pipeline = useAppSelector((state) => state.pipeline)

  return (
    <div>
      <header className="mb-6 grid grid-cols-[minmax(240px,1fr)_220px_minmax(180px,1fr)] items-center">
        <div>
          <h1 className="text-[20px] font-bold">Project overview</h1>
          <p className="mt-1 text-[13px] font-medium text-[#9299aa]">Track experiments, models, and evaluation results</p>
        </div>
        <button onClick={() => dispatch(setNewExperimentOpen(true))} className="mx-auto flex h-12 w-[190px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#25283a] px-5 text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(37,40,58,.18)]"><Plus size={18} /> New experiment</button>
        <div className="justify-self-end">
          <h2 className="text-[18px] font-bold">Runtime</h2>
          <p className="mt-1 text-[13px] font-medium text-[#7d8497]">Ready · llama.cpp CPU</p>
        </div>
      </header>

      <div className="overview-grid grid grid-cols-[minmax(440px,1.75fr)_minmax(300px,.75fr)] gap-5">
        <div className="space-y-5">
          <section className="flex min-h-[185px] items-stretch rounded-[28px] border border-[#e0e3ea] bg-[linear-gradient(145deg,#fff,#fafbfc)] p-8 shadow-[0_14px_30px_rgba(37,40,58,.09),0_1px_0_rgba(255,255,255,.95)_inset,0_-1px_0_rgba(37,40,58,.035)_inset]">
            <div className="mr-7 grid size-16 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#bdc5d3,#25283a)] text-white"><Boxes size={27} /></div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div><h2 className="text-[16px] font-bold">{appConfig.study.title}</h2><p className="mt-2 text-[11px] font-semibold text-[#abb2c1]">{appConfig.model.name} &nbsp; · &nbsp; {appConfig.study.lastRun}</p></div>
                <button onClick={() => dispatch(setView('experiments'))} className="rounded-full bg-[#f4f5f7] px-4 py-2.5 text-[11px] font-bold">Open study</button>
              </div>
              <div className="mt-12 grid grid-cols-5 gap-5">
                {[['Images','686'],['Classes','3'],['Variants','2'],['Baseline','75%'],['Status','Ready']].map(([key,value]) =>
                  <div key={key} className="border-r border-[#edf0f4] last:border-0"><p className="text-[11px] font-semibold text-[#abb2c1]">{key}</p><p className="mt-2 text-[13px] font-extrabold">{value}</p></div>)}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#e0e3ea] bg-[linear-gradient(145deg,#fff,#fafbfc)] p-8 shadow-[0_14px_30px_rgba(37,40,58,.09),0_1px_0_rgba(255,255,255,.95)_inset,0_-1px_0_rgba(37,40,58,.035)_inset]">
            <div className="flex items-start justify-between border-b border-[#eef0f4] pb-6">
              <div><h2 className="text-[15px] font-bold">Research pipeline</h2><p className="mt-2 text-[11px] font-semibold text-[#adb4c2]">Source model to evaluation evidence</p></div>
              <span className="rounded-full bg-[#f1f3f6] px-3 py-1.5 text-[11px] font-bold text-[#697187]">{pipeline.status === 'running' ? `${pipeline.percent}% running` : '2 active'}</span>
            </div>
            <div className="space-y-7 pt-6">
              {stages.map((stage) => (
                <div key={stage.label}>
                  <div className="mb-3 flex items-center gap-4">
                    <div className="grid size-14 shrink-0 place-items-center rounded-[17px] bg-[#25283a] text-white"><stage.icon size={20} /></div>
                    <div className="min-w-0 flex-1"><h3 className="text-[13px] font-bold">{stage.label}</h3><p className="mt-1 text-[11px] font-semibold text-[#adb4c2]">{stage.sub}</p></div>
                    <strong className="text-[12px]">{stage.label === 'Quantization' && pipeline.status === 'running' ? `${pipeline.percent}%` : stage.state}</strong>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-[#e3e6ec]"><div className="h-full rounded-full bg-[#25283a]" style={{ width: `${stage.state === 'Complete' ? 100 : stage.label === 'Dataset' ? 100 : stage.label === 'Quantization' && pipeline.status === 'running' ? pipeline.percent : 62}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="min-h-[185px] rounded-[28px] border border-[#e0e3ea] bg-[linear-gradient(145deg,#fff,#fafbfc)] p-7 shadow-[0_14px_30px_rgba(37,40,58,.09),0_1px_0_rgba(255,255,255,.95)_inset,0_-1px_0_rgba(37,40,58,.035)_inset]">
            <div className="flex items-start justify-between"><div><h2 className="text-[23px] font-black">120</h2><p className="mt-2 text-[11px] font-semibold text-[#adb4c2]">Evaluation samples</p></div><button onClick={() => dispatch(setView('results'))} className="text-[11px] font-bold">See all</button></div>
            <div className="mt-10 grid grid-cols-5 gap-2">
              {[
                ['Baseline','75%'],
                ['Q4','—'],
                ['Q8','—'],
                ['Latency','2.13s'],
                ['Runs','3'],
              ].map(([label, value]) =>
                <div key={label} className="text-center"><div className="mx-auto grid size-14 place-items-center rounded-[17px] border border-[#edf0f4] bg-[#25283a] text-[12px] font-bold text-white shadow-[0_6px_14px_rgba(37,40,58,.12)]">{value}</div><p className="mt-3 text-[10px] font-bold text-[#adb4c2]">{label}</p></div>)}
            </div>
          </section>

          <section className="rounded-[28px] border border-[#e0e3ea] bg-[linear-gradient(145deg,#fff,#fafbfc)] p-7 shadow-[0_14px_30px_rgba(37,40,58,.09),0_1px_0_rgba(255,255,255,.95)_inset,0_-1px_0_rgba(37,40,58,.035)_inset]">
            <div className="flex justify-between"><div><h2 className="text-[15px] font-bold">Run configuration</h2><p className="mt-2 text-[11px] font-semibold text-[#adb4c2]">Execution preferences</p></div><button onClick={() => dispatch(setView('models'))} className="text-[11px] font-bold">Configure</button></div>
            <div className="mt-8 space-y-7">
              <div className="flex items-center justify-between"><div><h3 className="text-[13px] font-bold">CPU execution</h3><p className="mt-2 text-[11px] font-semibold text-[#adb4c2]">llama.cpp &nbsp; · &nbsp; local runtime</p></div><Toggle /></div>
              <div className="flex items-center justify-between"><div><h3 className="text-[13px] font-bold">Quantization comparison</h3><p className="mt-2 text-[11px] font-semibold text-[#adb4c2]">Q4_K_M &nbsp; · &nbsp; Q8_0</p></div><Toggle /></div>
              <div className="flex items-center justify-between"><div><h3 className="text-[13px] font-bold">Save reproducible logs</h3><p className="mt-2 text-[11px] font-semibold text-[#adb4c2]">Metrics &nbsp; · &nbsp; model outputs</p></div><Toggle /></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
