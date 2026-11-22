import { Download } from 'lucide-react'
import { appConfig } from '../config'
import { Metric } from '../components/Metric'
import { PageIntro } from '../components/PageIntro'

export function ResultsPage() {
  return (
    <>
      <PageIntro eyebrow="EVIDENCE" title="Results" description="Compare variants and understand where the model succeeds or fails." action={<button className="flex h-12 items-center gap-2 rounded-full border border-[#dfe3ea] bg-white px-5 text-[13px] font-bold shadow-[0_6px_16px_rgba(37,40,58,.06)]"><Download size={17} /> Export report</button>} />
      <section className="rounded-[28px] border border-[#e0e3ea] bg-[linear-gradient(145deg,#fff,#fafbfc)] p-7 shadow-[0_14px_30px_rgba(37,40,58,.09),0_1px_0_rgba(255,255,255,.95)_inset]">
        <div className="flex items-start justify-between"><div><h2 className="text-[15px] font-bold">Zero-shot baseline</h2><p className="mt-1 text-[11px] font-semibold text-[#9299aa]">{appConfig.model.name} · {appConfig.dataset.name} · {appConfig.study.sampleCount} images</p></div><span className="rounded-full bg-[#f1f3f6] px-3 py-1.5 text-[10px] font-bold">{appConfig.study.modelVariant}</span></div>
        <div className="mt-6 grid grid-cols-4 gap-4">{[...appConfig.metrics, { label: 'Mean latency', value: appConfig.result.latency }].map((metric) => <div key={metric.label} className="rounded-[18px] border border-[#edf0f4] bg-[#fafbfc] p-4"><Metric {...metric} /></div>)}</div>
      </section>
    </>
  )
}
