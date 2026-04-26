'use client'

import type { Reel } from '@/lib/types'
import { Eye, Heart, MessageCircle, ExternalLink, TrendingUp, Users } from 'lucide-react'

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

interface Props {
  username: string
  reels: Reel[]
}

function CompetitorReel({ reel, rank }: { reel: Reel; rank: number }) {
  const engRate = reel.views > 0
    ? (((reel.likes + reel.comments) / reel.views) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="flex gap-3 p-3 rounded-xl border border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-600/50 transition-all duration-300 group animate-fade-in-up" style={{ animationDelay: `${Math.min(rank * 0.04, 0.4)}s`, animationFillMode: 'both' }}>
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
        ${rank <= 3 ? 'bg-[#1de9b6]/10 text-[#1de9b6]' : 'bg-slate-700/50 text-slate-500'}
      `}>
        {rank}
      </div>
      {reel.thumbnailUrl && (
        <img
          src={`/api/proxy-image?url=${encodeURIComponent(reel.thumbnailUrl)}`}
          alt=""
          className="flex-shrink-0 w-12 h-16 rounded-lg object-cover group-hover:scale-105 transition-transform duration-300"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mb-2">
          {reel.caption || '(no caption)'}
        </p>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1 font-medium">
            <Eye className="w-3 h-3 text-sky-400" /> {fmt(reel.views)}
          </span>
          <span className="flex items-center gap-1 font-medium">
            <Heart className="w-3 h-3 text-rose-400" /> {fmt(reel.likes)}
          </span>
          <span className="flex items-center gap-1 font-medium">
            <MessageCircle className="w-3 h-3 text-violet-400" /> {fmt(reel.comments)}
          </span>
          <span className="text-[#1de9b6] font-mono font-bold">{engRate}%</span>
          <a
            href={reel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto hover:text-[#1de9b6] transition-colors p-1 rounded hover:bg-slate-700/50"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}

export default function CompetitorSection({ username, reels }: Props) {
  const sorted = [...reels].sort((a, b) => b.views - a.views)
  const avgViews = reels.length > 0 ? reels.reduce((s, r) => s + r.views, 0) / reels.length : 0
  const avgEng = reels.length > 0
    ? reels.reduce((s, r) => s + (r.views > 0 ? (r.likes + r.comments) / r.views : 0), 0) / reels.length * 100
    : 0
  const topReel = reels.length > 0 ? reels.reduce((a, b) => (b.views > a.views ? b : a), reels[0]) : null

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 overflow-hidden animate-fade-in-up backdrop-blur-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-700/40 flex items-center justify-center">
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">@{username}</h3>
            <p className="text-[11px] text-slate-500 font-medium">{reels.length} reels scraped</p>
          </div>
        </div>
        <div className="flex gap-5 text-right">
          <div>
            <div className="text-lg font-black text-amber-400 tracking-tight">{fmt(avgViews)}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">avg views</div>
          </div>
          <div>
            <div className="text-lg font-black text-[#1de9b6] tracking-tight">{avgEng.toFixed(1)}%</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">avg eng.</div>
          </div>
          {topReel && (
            <div className="hidden sm:block">
              <div className="text-lg font-black text-white tracking-tight">{fmt(topReel.views)}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">best reel</div>
            </div>
          )}
        </div>
      </div>

      {/* Reels list */}
      <div className="p-4 flex flex-col gap-2.5 max-h-[500px] overflow-y-auto">
        {sorted.slice(0, 10).map((reel, i) => (
          <CompetitorReel key={reel.id} reel={reel} rank={i + 1} />
        ))}
        {reels.length === 0 && (
          <div className="flex flex-col items-center py-10 text-slate-500">
            <TrendingUp className="w-8 h-8 mb-3 text-slate-600" />
            <p className="text-sm">No data scraped yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
