import type { ReactNode } from 'react'

interface PageIntroProps {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}

export function PageIntro({ eyebrow, title, description, action }: PageIntroProps) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#969dac]">{eyebrow}</p>
        <h1 className="mt-1 text-[20px] font-bold">{title}</h1>
        <p className="mt-1 text-[13px] font-medium text-[#9299aa]">{description}</p>
      </div>
      {action}
    </div>
  )
}
