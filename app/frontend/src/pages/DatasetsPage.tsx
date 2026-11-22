import { Database, Plus, Search } from 'lucide-react'
import { appConfig } from '../config'
import { PageIntro } from '../components/PageIntro'

export function DatasetsPage() {
  return (
    <>
      <PageIntro eyebrow="DATA REGISTRY" title="Datasets" description="Version your data, labels, splits, and lineage." action={<button className="flex h-12 items-center gap-2 rounded-full bg-[#25283a] px-5 text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(37,40,58,.18)]"><Plus size={17} /> Register dataset</button>} />
      <section className="overflow-hidden rounded-[28px] border border-[#e0e3ea] bg-[linear-gradient(145deg,#fff,#fafbfc)] shadow-[0_14px_30px_rgba(37,40,58,.09),0_1px_0_rgba(255,255,255,.95)_inset]">
        <div className="flex items-center justify-between border-b border-[#edf0f4] px-7 py-5"><div><h2 className="text-[15px] font-bold">Registered datasets</h2><p className="mt-1 text-[11px] font-semibold text-[#9299aa]">Fixed splits preserve reproducibility across experiments.</p></div><div className="flex h-10 items-center gap-2 rounded-full border border-[#e5e8ef] bg-[#f7f8fa] px-4 text-[11px] font-semibold text-[#9299aa]"><Search size={16} />Search datasets</div></div>
        <div className="px-7">
          <div className="grid grid-cols-[1.5fr_.7fr_.8fr_.8fr_.5fr] py-4 text-[10px] font-bold uppercase tracking-[.08em] text-[#a1a7b5]"><span>Name</span><span>Records</span><span>Split</span><span>Labels</span><span>Version</span></div>
          <div className="grid grid-cols-[1.5fr_.7fr_.8fr_.8fr_.5fr] items-center border-t border-[#edf0f4] py-5 text-[12px]"><strong className="flex items-center gap-2"><Database size={17} /> {appConfig.dataset.name}</strong><span>{appConfig.dataset.records}</span><span>{appConfig.dataset.split}</span><span>{appConfig.dataset.labels}</span><span className="w-fit rounded-full bg-[#edf0f4] px-3 py-1 text-[10px] font-bold">v1</span></div>
          <div className="grid grid-cols-[1.5fr_.7fr_.8fr_.8fr_.5fr] items-center border-t border-[#edf0f4] py-5 text-[12px]"><strong className="flex items-center gap-2"><Database size={17} /> {appConfig.secondaryDataset.name}</strong><span>{appConfig.secondaryDataset.records}</span><span>{appConfig.secondaryDataset.split}</span><span>{appConfig.secondaryDataset.labels}</span><span className="w-fit rounded-full bg-[#f1f3f6] px-3 py-1 text-[10px] font-bold text-[#9299aa]">{appConfig.secondaryDataset.version}</span></div>
        </div>
      </section>
    </>
  )
}
