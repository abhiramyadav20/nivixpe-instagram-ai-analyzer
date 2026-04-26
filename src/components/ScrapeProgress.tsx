'use client'

import { Loader2 } from 'lucide-react'

interface Props {
  message: string
  subtext?: string
}

export default function ScrapeProgress({ message, subtext }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up">
      <div className="relative mb-6">
        {/* Outer ring */}
        <div className="w-16 h-16 rounded-full border-2 border-slate-700/50 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-[#1de9b6] animate-spin" />
        </div>
        {/* Pulsing rings */}
        <div className="absolute inset-0 rounded-full border-2 border-[#1de9b6]/10 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute -inset-2 rounded-full border border-[#1de9b6]/5 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.3s' }} />
      </div>
      <p className="text-white font-semibold text-lg tracking-tight">{message}</p>
      {subtext && <p className="text-slate-500 text-sm mt-2 max-w-md">{subtext}</p>}
      
      {/* Progress dots */}
      <div className="flex gap-2 mt-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-[#1de9b6]/40"
            style={{
              animation: `teal-pulse 1.5s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
