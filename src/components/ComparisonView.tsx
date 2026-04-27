'use client'

import type { Reel } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, AlertCircle, Target, Award, Zap } from 'lucide-react'
import clsx from 'clsx'

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return Math.round(n).toLocaleString()
}

const THEME_KEYWORDS: Record<string, string[]> = {
  'Finance/Money': ['money', 'cash', 'bank', 'earnings', 'revenue', 'profit', 'payments', 'transfer', 'card', 'save', 'budget', 'interest', 'fintech', 'currency', 'fees', 'wise', 'revolut', 'nivixpe'],
  'Global/Travel': ['global', 'international', 'borderless', 'world', 'abroad', 'exchange', 'travel', 'trip', 'flight', 'vacation', 'paris', 'london', 'nyc', 'melbourne', 'airport', 'globe', 'city', 'usa', 'uk', 'europe'],
  'Tech/Innovation': ['tech', 'digital', 'app', 'innovation', 'future', 'instant', 'fast', 'speed', 'real-time', 'blockchain', 'ai', 'air', 'assistant', 'chat', 'automation', 'announced', 'macbook'],
  'Security/Trust': ['secure', 'safe', 'transparent', 'trust', 'simple', 'easy', 'hidden fees', 'no fees', 'license', 'profitability', 'report', 'undercover', 'privacy', 'fscs', 'protected'],
  'Tutorials/Tips': ['how to', 'guide', 'tutorial', 'learn', 'tips', 'tricks', 'step by step', 'guide', 'explain', 'insight', 'thinking about', 'why', 'what', 'which', 'rather'],
  'Lifestyle/Food': ['lifestyle', 'perks', 'rewards', 'points', 'miles', 'shopping', 'dining', 'hotel', 'experience', 'food', 'pastry', 'cakes', 'coffee', 'visit', 'store', 'everyday', 'spending'],
  'Community/Social': ['event', 'hiring', 'team', 'join', 'office', 'career', 'community', 'blues', 'mancity', 'semis', 'final', 'fans', 'debut', 'stadium'],
  'Brand/Updates': ['launch', 'update', 'announced', 'available', 'live', 'beta', 'access', 'rolling out', 'underway', 'coming monday', 'new', 'official', 'licensed'],
}

function detectThemes(reels: Reel[]): Record<string, number> {
  const scores: Record<string, number> = {}
  if (reels.length === 0) return scores

  const count = reels.length
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    let rawScore = 0
    for (const r of reels) {
      const text = `${r.caption} ${r.transcript ?? ''}`.toLowerCase()
      rawScore += keywords.reduce((s, kw) => s + (text.split(kw).length - 1), 0)
    }
    scores[theme] = (rawScore / count) * 10
  }
  return scores
}

function detectThemesAll(reels: Reel[]): Record<string, number> {
  return detectThemes(reels)
}

const ACCOUNT_COLORS = ['#1de9b6', '#8b5cf6', '#06b6d4', '#f59e0b']
const ACCOUNT_BG = ['rgba(29,233,182,0.08)', 'rgba(139,92,246,0.08)', 'rgba(6,182,212,0.08)', 'rgba(245,158,11,0.08)']

interface Props {
  myReels: Reel[]
  competitors: Record<string, Reel[]>
  myUsername?: string
  contentType: 'video' | 'post' | 'all'
}

export default function ComparisonView({ myReels, competitors, myUsername = 'nivixpe', contentType }: Props) {
  const isVideo = contentType === 'video'
  const isPost = contentType === 'post'
  const isAll = contentType === 'all'
  const primaryMetric = isPost ? 'likes' : 'views'
  const allAccounts = [
    { username: myUsername, reels: Array.isArray(myReels) ? myReels : [], isMe: true },
    ...Object.entries(competitors || {}).map(([username, reels]) => ({ 
      username, 
      reels: Array.isArray(reels) ? reels : [], 
      isMe: false 
    })),
  ].filter((a) => a.reels && a.reels.length > 0)

  if (allAccounts.length < 2) {
    return (
      <div className="flex items-center gap-4 rounded-xl p-6 animate-fade-in-up" style={{ background: 'rgba(29,233,182,0.06)', border: '1px solid rgba(29,233,182,0.2)', color: '#1de9b6' }}>
        <div className="w-12 h-12 rounded-xl bg-[#1de9b6]/10 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <p className="font-semibold text-sm">Need more data</p>
          <p className="text-xs opacity-70 mt-0.5">Fetch your {isVideo ? 'reels' : 'posts'} and at least one competitor to see the comparison.</p>
        </div>
      </div>
    )
  }

  // ─── Metrics ────────────────────────────────────────────────────────────────
  const metrics = allAccounts.map((a, i) => {
    const valid = a.reels.filter(r => r && typeof r === 'object')
    const avg = valid.reduce((s, r) => s + (Number(r[primaryMetric]) || 0), 0) / (valid.length || 1)
    const avgEng = isVideo
      ? valid.reduce((s, r) => s + (r.views > 0 ? (Number(r.likes) + Number(r.comments)) / r.views : 0), 0) / (valid.length || 1) * 100
      : valid.reduce((s, r) => s + (Number(r.likes) + Number(r.comments)), 0) / (valid.length || 1)
    const topContent = valid.reduce((best, r) => (Number(r[primaryMetric]) || 0) > (Number(best[primaryMetric]) || 0) ? r : best, valid[0] || a.reels[0])
    return { ...a, reels: valid, avgMetric: avg, avgEng, topContent, color: ACCOUNT_COLORS[i], bg: ACCOUNT_BG[i] }
  })

  const meMetrics = metrics[0]
  const chartData = metrics.map((m) => ({ name: `@${m.username}`, metricVal: Math.round(m.avgMetric), eng: parseFloat(m.avgEng.toFixed(2)) }))

  // ─── Theme analysis ─────────────────────────────────────────────────────────
  const themeScores = metrics.map((m) => ({ username: m.username, themes: detectThemesAll(m.reels), isMe: m.isMe }))
  const allThemes = Object.keys(THEME_KEYWORDS)

  // Radar chart data
  const maxByTheme: Record<string, number> = {}
  for (const theme of allThemes) {
    maxByTheme[theme] = Math.max(1, ...themeScores.map((t) => t.themes[theme] ?? 0))
  }
  const radarData = allThemes.map((theme) => {
    const row: Record<string, string | number> = { theme }
    for (const ts of themeScores) {
      const val = ts.themes[theme] ?? 0
      row[ts.username] = Math.round(((val) / maxByTheme[theme]) * 95) + 5
    }
    return row
  })

  // ─── Gaps ───────────────────────────────────────────────────────────────────
  const myThemes = themeScores[0].themes
  const competitorThemes: Record<string, number> = {}
  for (const ts of themeScores.slice(1)) {
    for (const [theme, score] of Object.entries(ts.themes)) {
      competitorThemes[theme] = (competitorThemes[theme] ?? 0) + score
    }
  }

  const gaps = allThemes
    .filter((t) => competitorThemes[t] > 5 && (myThemes[t] ?? 0) < competitorThemes[t] * 0.4)
    .sort((a, b) => competitorThemes[b] - competitorThemes[a])
    .slice(0, 4)

  const strengths = allThemes
    .filter((t) => (myThemes[t] ?? 0) > 3)
    .sort((a, b) => (myThemes[b] ?? 0) - (myThemes[a] ?? 0))
    .slice(0, 4)

  return (
    <div className="space-y-6">
      {/* ── Stat cards ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(metrics.length, 4)}, minmax(0, 1fr))` }}>
        {metrics.map((m, i) => (
          <div
            key={m.username}
            className={clsx(
              'rounded-xl border p-5 transition-all duration-300 card-hover animate-fade-in-up',
              m.isMe ? 'border-[#1de9b6]/20 bg-[#1de9b6]/[0.04]' : 'border-slate-700/40 bg-slate-800/40'
            )}
            style={{ animationDelay: `${i * 0.08}s`, animationFillMode: 'both' }}
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: m.color, boxShadow: `0 0 0 2px var(--color-surface-950), 0 0 0 4px ${m.color}40` }} />
              <span className="font-bold text-sm" style={{ color: m.isMe ? '#1de9b6' : '#cbd5e1' }}>
                @{m.username}
                {m.isMe && <span className="text-[10px] text-slate-500 ml-1.5 font-medium">(you)</span>}
              </span>
            </div>
            <div className="text-3xl font-black text-white tracking-tight">{fmt(m.avgMetric)}</div>
            <div className="text-xs text-slate-500 mb-3 font-medium">avg {primaryMetric} / {isPost ? 'post' : isAll ? 'item' : 'reel'}</div>
            <div className="flex items-center gap-1.5 text-sm">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-bold">{isVideo ? m.avgEng.toFixed(1) + '%' : fmt(m.avgEng)}</span>
              <span className="text-slate-600 text-xs">{isVideo ? 'eng. rate' : 'avg engagement'}</span>
            </div>
            {i > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700/40">
                {m.avgMetric > meMetrics.avgMetric ? (
                  <div className="flex items-center gap-1.5 text-xs text-rose-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="font-semibold">{Math.round(((m.avgMetric - meMetrics.avgMetric) / meMetrics.avgMetric) * 100)}%</span>
                    <span className="text-rose-400/70">more {primaryMetric} than you</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span className="font-semibold">You&apos;re beating by {Math.round(((meMetrics.avgMetric - m.avgMetric) / m.avgMetric) * 100)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Avg views bar chart ── */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-5 animate-fade-in-up backdrop-blur-sm">
        <h3 className="text-sm font-bold text-slate-200 mb-1">Avg {isPost ? 'Likes' : 'Views'} Comparison</h3>
        <p className="text-xs text-slate-500 mb-5">Performance across all tracked accounts</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} layout="vertical" barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 6" stroke="#1e293b" horizontal={false} />
            <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} axisLine={false} tickLine={false} width={110} />
            <Tooltip
              formatter={(v: number) => fmt(v)}
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, fontSize: 12, color: '#f0f4f8' }}
              itemStyle={{ color: '#f0f4f8' }}
            />
            <Bar dataKey="metricVal" radius={[0, 6, 6, 0]} maxBarSize={32} animationDuration={800}>
              {chartData.map((_, i) => (
                <rect key={i} fill={ACCOUNT_COLORS[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Radar / theme comparison ── */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-5 animate-fade-in-up backdrop-blur-sm">
        <h3 className="text-sm font-bold text-slate-200 mb-1">Content Theme Comparison</h3>
        <p className="text-xs text-slate-500 mb-5">Based on caption & transcript keyword analysis</p>
        <ResponsiveContainer width="100%" height={340}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#1e293b" />
            <PolarAngleAxis dataKey="theme" tick={{ fontSize: 10, fill: '#64748b' }} />
            {themeScores.map((ts, i) => (
              <Radar
                key={ts.username}
                name={`@${ts.username}`}
                dataKey={ts.username}
                stroke={ACCOUNT_COLORS[i]}
                strokeWidth={2.5}
                fill={ACCOUNT_COLORS[i]}
                fillOpacity={ts.isMe ? 0.25 : 0.1}
              />
            ))}
            <Legend
              formatter={(v) => <span className="text-xs text-slate-400 font-medium">{v}</span>}
              wrapperStyle={{ paddingTop: 16 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Strengths & Gaps ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 animate-fade-in-up">
          <h3 className="text-sm font-bold text-emerald-300 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4" /> Your Strengths
          </h3>
          {strengths.length > 0 ? (
            <div className="space-y-3">
              {strengths.map((t) => (
                <div key={t} className="flex items-center justify-between group">
                  <span className="text-sm text-slate-300 font-medium">{t}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-full bg-emerald-500/30 transition-all duration-500 group-hover:bg-emerald-500/50" style={{ width: `${Math.min(100, (myThemes[t] / 10) * 100)}px` }} />
                    <span className="text-[11px] text-slate-500 font-mono w-14 text-right">{myThemes[t].toFixed(1)} signals</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Fetch your {isVideo ? 'reels' : 'posts'} to analyze strengths.</p>
          )}
        </div>

        <div className="rounded-xl border border-rose-500/15 bg-rose-500/[0.04] p-5 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="text-sm font-bold text-rose-300 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4" /> Content Gaps
          </h3>
          {gaps.length > 0 ? (
            <div className="space-y-3">
              {gaps.map((t) => (
                <div key={t} className="flex items-center justify-between group">
                  <span className="text-sm text-slate-300 font-medium">{t}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-full bg-rose-500/30 transition-all duration-500 group-hover:bg-rose-500/50" style={{ width: `${Math.min(100, (competitorThemes[t] / 20) * 100)}px` }} />
                    <span className="text-[11px] text-slate-500 font-mono w-14 text-right">{competitorThemes[t].toFixed(1)} signals</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No significant gaps detected.</p>
          )}
        </div>
      </div>

      {/* ── Top reels comparison ── */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 overflow-hidden animate-fade-in-up backdrop-blur-sm">
        <div className="px-5 py-4 border-b border-slate-700/40">
          <h3 className="text-sm font-bold text-slate-200">Top {isVideo ? 'Reel' : 'Post'} per Account</h3>
        </div>
        <div className="divide-y divide-slate-700/30">
          {metrics.map((m, i) => (
            <div
              key={m.username}
              className="flex gap-4 p-4 items-start hover:bg-slate-700/20 transition-colors duration-300"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5" style={{ background: m.color, boxShadow: `0 0 0 2px var(--color-surface-950), 0 0 0 4px ${m.color}40` }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-bold text-slate-200">@{m.username}</span>
                  {m.isMe && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-[#1de9b6]/10 text-[#1de9b6]">
                      YOU
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mb-2.5 leading-relaxed">{m.topContent?.caption || '(no caption)'}</p>
                {m.topContent && (
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-white font-bold bg-slate-700/50 px-2.5 py-1 rounded-lg">{fmt(m.topContent[primaryMetric])} {primaryMetric}</span>
                    <span className="text-slate-500">{isVideo ? `❤️ ${fmt(m.topContent.likes)}` : `💬 ${fmt(m.topContent.comments)}`}</span>
                    <a
                      href={m.topContent.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1de9b6] hover:text-[#0fb98f] ml-auto font-semibold transition-colors hover:underline"
                    >
                      View →
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
