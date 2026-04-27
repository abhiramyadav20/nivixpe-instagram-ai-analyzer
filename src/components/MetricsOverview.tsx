'use client'

import { useEffect, useState, useRef } from 'react'
import type { Reel } from '@/lib/types'
import { Eye, Heart, TrendingUp, BarChart2, Zap, ThumbsDown } from 'lucide-react'

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return Math.round(n).toLocaleString()
}

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const startTime = useRef<number | null>(null)
  const startValue = useRef(0)

  useEffect(() => {
    startValue.current = display
    startTime.current = null
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp
      const progress = Math.min((timestamp - startTime.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(Math.round(startValue.current + (value - startValue.current) * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [value, duration])

  return <span>{fmt(display)}</span>
}

export default function MetricsOverview({ reels, contentType }: { reels: Reel[]; contentType: 'video' | 'post' | 'all' }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const validReels = (reels || []).filter(r => r && typeof r === 'object')
  if (validReels.length === 0) return null

  const isVideo = contentType === 'video'
  const isPost = contentType === 'post'
  const isAll = contentType === 'all'
  const primaryMetric = isPost ? 'likes' : 'views'

  const totalViews = validReels.reduce((s, r) => s + (Number(r.views) || 0), 0)
  const totalLikes = validReels.reduce((s, r) => s + (Number(r.likes) || 0), 0)

  const avgViews = totalViews / validReels.length
  const avgLikes = totalLikes / validReels.length
  const avgEngVideo = isVideo
    ? validReels.reduce((s, r) => s + (r.views > 0 ? (Number(r.likes) + Number(r.comments)) / r.views : 0), 0) / validReels.length * 100
    : 0

  const postEngagement = (isPost || isAll)
    ? validReels.reduce((s, r) => s + (Number(r.likes) + Number(r.comments)), 0) / validReels.length
    : 0

  const topReel = validReels.reduce((a, b) => (Number(b[primaryMetric]) || 0) > (Number(a[primaryMetric]) || 0) ? b : a, validReels[0])
  const lowReel = validReels.reduce((a, b) => (Number(b[primaryMetric]) || 0) < (Number(a[primaryMetric]) || 0) ? b : a, validReels[0])
  const topCount = validReels.filter((r) => r && r.performance === 'top').length
  const lowCount = validReels.filter((r) => r && r.performance === 'low').length

  const stats = [
    {
      icon: isPost ? <Heart className="w-5 h-5 text-sky-400" /> : <Eye className="w-5 h-5 text-sky-400" />,
      label: isPost ? 'Total Likes' : 'Total Views',
      value: isPost ? totalLikes : totalViews,
      rawValue: isPost ? totalLikes : totalViews,
      sub: `${reels.length} ${isAll ? 'items' : isVideo ? 'reels' : 'posts'}`,
      gradient: 'from-sky-500/10',
      border: 'border-sky-500/20',
    },
    {
      icon: <BarChart2 className="w-5 h-5 text-violet-400" />,
      label: isPost ? 'Avg Likes / Post' : 'Avg Views / Reel',
      value: isPost ? avgLikes : avgViews,
      rawValue: isPost ? avgLikes : avgViews,
      sub: 'last 30 days',
      gradient: 'from-violet-500/10',
      border: 'border-violet-500/20',
    },
    {
      icon: isPost ? <Eye className="w-5 h-5 text-rose-400" /> : <Heart className="w-5 h-5 text-rose-400" />,
      label: isPost ? 'Avg Engagement' : 'Total Likes',
      value: isPost ? postEngagement : totalLikes,
      rawValue: isPost ? postEngagement : totalLikes,
      sub: isPost ? 'likes + comments / post' : `${avgEngVideo.toFixed(1)}% avg eng.`,
      gradient: 'from-rose-500/10',
      border: 'border-rose-500/20',
    },
    {
      icon: <TrendingUp className="w-5 h-5" style={{ color: '#1de9b6' }} />,
      label: isAll ? 'Best Content' : isVideo ? 'Best Reel' : 'Best Post',
      value: topReel ? topReel[primaryMetric] : 0,
      rawValue: topReel ? topReel[primaryMetric] : 0,
      sub: topReel ? new Date(topReel.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No data',
      gradient: 'from-teal-500/10',
      border: 'border-[#1de9b6]/20',
      highlight: true,
    },
    {
      icon: <Zap className="w-5 h-5 text-emerald-400" />,
      label: 'Top Performers',
      value: topCount,
      rawValue: topCount,
      sub: `${Math.round((topCount / reels.length) * 100)}% of content`,
      gradient: 'from-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      icon: <ThumbsDown className="w-5 h-5 text-red-400" />,
      label: 'Underperforming',
      value: lowCount,
      rawValue: lowCount,
      sub: `${Math.round((lowCount / reels.length) * 100)}% of content`,
      gradient: 'from-red-500/10',
      border: 'border-red-500/20',
    },
  ]

  return (
    <div ref={ref} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={`
            rounded-xl border p-4 transition-all duration-300 card-hover
            bg-gradient-to-b ${s.gradient} to-slate-800/80 ${s.border}
            ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}
          `}
          style={{ animationDelay: `${Math.min(i * 0.08, 0.5)}s`, animationFillMode: 'both' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className={`
              w-8 h-8 rounded-lg flex items-center justify-center
              ${s.highlight ? 'bg-[#1de9b6]/10' : 'bg-slate-700/30'}
            `}>
              {s.icon}
            </div>
            <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{s.label}</span>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {isVisible ? <AnimatedNumber value={s.rawValue} /> : fmt(s.rawValue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">{s.sub}</div>
        </div>
      ))}
    </div>
  )
}
