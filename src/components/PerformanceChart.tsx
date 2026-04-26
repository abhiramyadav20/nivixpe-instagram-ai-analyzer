'use client'

import type { Reel } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return String(n)
}

const PERF_COLOR = { top: '#1de9b6', mid: '#6366f1', low: '#f43f5e' }
const PERF_BG = { top: 'rgba(29,233,182,0.1)', mid: 'rgba(99,102,241,0.1)', low: 'rgba(244,63,94,0.1)' }

interface TooltipPayload {
  payload?: { metricVal: number; views: number; likes: number; comments: number; caption: string; isVideo: boolean; performance: string }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-slate-800/95 border border-slate-600/50 rounded-xl p-3.5 text-xs max-w-60 shadow-2xl backdrop-blur-sm">
      <div className="text-white font-bold mb-1.5 text-sm">{fmt(d.metricVal)} {d.isVideo ? 'views' : 'likes'}</div>
      <div className="flex gap-3 text-slate-400 mb-2">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> {fmt(d.likes)} likes
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> {fmt(d.comments)} comments
        </span>
      </div>
      <p className="text-slate-500 line-clamp-2 leading-relaxed border-t border-slate-700/50 pt-2">{d.caption}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-sm" style={{ background: PERF_COLOR[d.performance as keyof typeof PERF_COLOR] }} />
        <span className="text-slate-500 capitalize">{d.performance === 'top' ? 'Top performer' : d.performance === 'mid' ? 'Average' : 'Underperforming'}</span>
      </div>
    </div>
  )
}

export default function PerformanceChart({ reels, contentType }: { reels: Reel[]; contentType: 'video' | 'post' | 'all' }) {
  if (reels.length === 0) return null

  const isPost = contentType === 'post'
  const primaryMetric = isPost ? 'likes' : 'views'

  const sorted = [...reels].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const data = sorted.map((r, i) => ({
    name: `#${i + 1}`,
    metricVal: r[primaryMetric],
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    caption: r.caption.slice(0, 80),
    performance: r.performance ?? 'mid',
    isVideo: r.type === 'Video',
  }))

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-5 mb-8 animate-fade-in-up backdrop-blur-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-slate-200">{isPost ? 'Likes by Post' : 'Views by Reel'} <span className="text-slate-500 font-normal">(chronological)</span></h3>
        </div>
        <div className="flex gap-4">
          {(['top', 'mid', 'low'] as const).map((p) => (
            <div key={p} className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: PERF_COLOR[p] }} />
              {p === 'top' ? 'Top' : p === 'mid' ? 'Average' : 'Low'}
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 6" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <Bar
            dataKey="metricVal"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={PERF_COLOR[d.performance as keyof typeof PERF_COLOR]}
                fillOpacity={0.85}
                stroke={PERF_COLOR[d.performance as keyof typeof PERF_COLOR]}
                strokeWidth={1}
                strokeOpacity={0.3}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
