'use client'

import { useState, useCallback } from 'react'
import type { Reel } from '@/lib/types'
import { Eye, Heart, MessageCircle, Play, Loader2, FileText, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  reel: Reel
  onTranscribe?: (reel: Reel) => void
  transcribing?: boolean
  index?: number
}

const PERF_STYLES = {
  top: 'border-[#1de9b6]/30 bg-[#1de9b6]/[0.03] hover:border-[#1de9b6]/50',
  mid: 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600/60',
  low: 'border-rose-500/30 bg-rose-500/[0.03] hover:border-rose-500/50',
}

const PERF_BADGE = {
  top: 'bg-[#1de9b6]/15 text-[#1de9b6] border border-[#1de9b6]/25',
  mid: 'bg-slate-600/25 text-slate-400 border border-slate-600/25',
  low: 'bg-rose-500/15 text-rose-400 border border-rose-500/25',
}

const PERF_LABEL = { top: 'Top', mid: 'Avg', low: 'Low' }

const PERF_GLOW = {
  top: 'hover:shadow-[0_0_20px_rgba(29,233,182,0.08)]',
  mid: 'hover:shadow-[0_0_20px_rgba(99,102,241,0.05)]',
  low: 'hover:shadow-[0_0_20px_rgba(244,63,94,0.06)]',
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default function ReelCard({ reel, onTranscribe, transcribing, index = 0 }: Props) {
  const [showTranscript, setShowTranscript] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const perf = reel.performance ?? 'mid'
  const isVideo = reel.type === 'Video'
  const engRate = isVideo && reel.views > 0 ? (((reel.likes + reel.comments) / reel.views) * 100).toFixed(1) : '0.0'
  const postedDate = reel.timestamp ? new Date(reel.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'

  const handleImageLoad = useCallback(() => setImgLoaded(true), [])
  const handleImageError = useCallback(() => { setImgFailed(true); setImgLoaded(true); }, [])

  return (
    <div
      className={clsx(
        'rounded-xl border flex flex-col overflow-hidden transition-all duration-300',
        'animate-fade-in-up',
        PERF_STYLES[perf],
        PERF_GLOW[perf],
      )}
      style={{ animationDelay: `${Math.min(index * 0.04, 0.5)}s`, animationFillMode: 'both' }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] max-h-52 overflow-hidden bg-slate-800/80 flex-shrink-0">
        {/* Shimmer placeholder */}
        {!imgLoaded && !imgFailed && (
          <div className="absolute inset-0 skeleton" />
        )}
        
        {reel.thumbnailUrl && !imgFailed ? (
          <img
            src={`/api/proxy-image?url=${encodeURIComponent(reel.thumbnailUrl)}`}
            alt="reel"
            className={clsx(
              'w-full h-full object-cover transition-all duration-500',
              imgLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105',
            )}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Play className="w-8 h-8 text-slate-600" />
            {imgFailed && <span className="text-xs text-slate-600">preview unavailable</span>}
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        
        {/* Performance badge */}
        <div className="absolute top-2.5 right-2.5">
          <span className={clsx('text-[11px] px-2.5 py-1 rounded-full font-semibold backdrop-blur-sm', PERF_BADGE[perf])}>
            {PERF_LABEL[perf]}
          </span>
        </div>
        
        {/* Date badge */}
        <div className="absolute bottom-2.5 left-2.5">
          <span className="text-[11px] text-white/80 bg-black/40 backdrop-blur-sm rounded-md px-2 py-1 font-medium">
            {postedDate}
          </span>
        </div>
        
        {/* Video indicator */}
        {isVideo && (
          <div className="absolute top-2.5 left-2.5 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-3 h-3 text-white fill-white" />
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="flex justify-between items-center px-3 py-2.5 border-b border-slate-700/40 gap-2">
        {isVideo && (
          <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
            <Eye className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <span className="text-sm font-bold tracking-tight">{fmt(reel.views)}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-slate-300">
          <Heart className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
          <span className="text-sm font-semibold">{fmt(reel.likes)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300">
          <MessageCircle className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
          <span className="text-sm font-semibold">{fmt(reel.comments)}</span>
        </div>
        {isVideo && (
          <div className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded bg-[#1de9b6]/10 text-[#1de9b6]">
            {engRate}%
          </div>
        )}
      </div>

      {/* Caption */}
      <div className="px-3 pt-2.5 pb-1 flex-1">
        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
          {reel.caption || '(no caption)'}
        </p>
      </div>

      {/* Transcript section */}
      {reel.transcript && (
        <div className="mx-3 mb-2 mt-1">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1.5 transition-colors py-1"
          >
            <FileText className="w-3 h-3" />
            {showTranscript ? 'Hide transcript' : 'Show transcript'}
          </button>
          {showTranscript && (
            <div className="animate-fade-in">
              <p className="mt-1.5 text-xs text-slate-400 bg-slate-800/80 rounded-lg p-2.5 leading-relaxed max-h-28 overflow-y-auto border border-slate-700/30">
                {reel.transcript}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex gap-2 px-3 pb-3 pt-1">
        {!reel.transcript && reel.audioUrl && onTranscribe && (
          <button
            onClick={() => onTranscribe(reel)}
            disabled={transcribing}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-violet-600/15 hover:bg-violet-600/25 text-violet-300 border border-violet-600/20 rounded-lg py-1.5 transition-all disabled:opacity-50 btn-press"
          >
            {transcribing ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Transcribing…</>
            ) : (
              <><FileText className="w-3 h-3" /> Transcribe</>
            )}
          </button>
        )}
        <a
          href={reel.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#1de9b6] transition-colors ml-auto px-2 py-1.5 rounded-lg hover:bg-slate-800/60"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
