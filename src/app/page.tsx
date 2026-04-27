'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Reel } from '@/lib/types'
import ReelCard from '@/components/ReelCard'
import MetricsOverview from '@/components/MetricsOverview'
import PerformanceChart from '@/components/PerformanceChart'
import ScrapeProgress from '@/components/ScrapeProgress'
import CompetitorSection from '@/components/CompetitorSection'
import ComparisonView from '@/components/ComparisonView'
import {
  RefreshCw, LayoutDashboard, Users2, Lightbulb, AlertCircle,
  Loader2, Sparkles, Filter, Plus, X, Clock, GitCompare, ChevronRight,
  BarChart3, TrendingUp, Search, KeyRound, Zap
} from 'lucide-react'
import clsx from 'clsx'
import { puter } from '@heyputer/puter.js'

type Tab = 'mine' | 'competitors' | 'compare' | 'ideas'
type ScrapeState = 'idle' | 'starting' | 'polling' | 'fetching' | 'done' | 'error'
type PerfFilter = 'all' | 'top' | 'mid' | 'low'

const MY_URL = 'https://www.instagram.com/nivixpe/'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function pollStatus(runId: string): Promise<string> {
  const res = await fetch(`/api/scrape-status?runId=${runId}`)
  const data = await res.json()
  return data.status as string
}

async function startAndWait(
  instagramUrl: string,
  limit: number,
  onStatus: (s: ScrapeState) => void,
): Promise<Reel[]> {
  onStatus('starting')
  const startRes = await fetch('/api/start-scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instagramUrl, limit }),
  })
  if (!startRes.ok) {
    const err = await startRes.json()
    throw new Error(err.error ?? 'Failed to start scrape')
  }
  const { runId, datasetId } = await startRes.json()

  onStatus('polling')
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 6_000))
    const status = await pollStatus(runId)
    if (status === 'SUCCEEDED') break
    if (status === 'FAILED' || status === 'ABORTED') throw new Error('Apify run failed')
  }

  onStatus('fetching')
  const res = await fetch(`/api/scrape-results?datasetId=${datasetId}&limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch results')
  const { reels } = await res.json()
  return reels as Reel[]
}

async function saveCache(key: string, data: unknown) {
  await fetch('/api/cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, data }),
  })
}

async function loadCache<T>(key: string): Promise<T | null> {
  const res = await fetch(`/api/cache?key=${key}`)
  const { data } = await res.json()
  return data as T | null
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const SCRAPE_MSG: Record<ScrapeState, string> = {
  idle: '', starting: 'Starting Apify scraper…',
  polling: 'Scraping Instagram reels… (1–3 min)',
  fetching: 'Downloading results…', done: '', error: '',
}

// ─── Skeleton components ─────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-700/30 bg-slate-800/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded skeleton" />
            <div className="w-16 h-3 rounded skeleton" />
          </div>
          <div className="w-20 h-7 rounded skeleton mb-1" />
          <div className="w-12 h-3 rounded skeleton" />
        </div>
      ))}
    </div>
  )
}

function ReelSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-700/30 bg-slate-800/30 overflow-hidden">
          <div className="aspect-[9/16] max-h-52 skeleton" />
          <div className="p-3 space-y-2">
            <div className="flex gap-2">
              <div className="w-12 h-3 rounded skeleton" />
              <div className="w-10 h-3 rounded skeleton" />
            </div>
            <div className="w-full h-3 rounded skeleton" />
            <div className="w-2/3 h-3 rounded skeleton" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('mine')
  const [contentType, setContentType] = useState<'video' | 'post' | 'all'>('all')
  const [tabAnimating, setTabAnimating] = useState(false)

  // My reels
  const [cacheLoading, setCacheLoading] = useState(true)
  const [myReels, setMyReels] = useState<Reel[]>([])
  const [myLastSynced, setMyLastSynced] = useState<string | null>(null)
  const [myScrapeState, setMyScrapeState] = useState<ScrapeState>('idle')
  const [myError, setMyError] = useState('')
  const [perfFilter, setPerfFilter] = useState<PerfFilter>('all')
  const [transcribingId, setTranscribingId] = useState<string | null>(null)

  // Competitors
  const [competitors, setCompetitors] = useState<Record<string, Reel[]>>({})
  const [compLastSynced, setCompLastSynced] = useState<Record<string, string>>({})
  const [scrapingUsernames, setScrapingUsernames] = useState<Set<string>>(new Set())
  const [compErrors, setCompErrors] = useState<Record<string, string>>({})
  const [newUsername, setNewUsername] = useState('')

  // Ideas
  const [ideas, setIdeas] = useState('')
  const [ideasLoading, setIdeasLoading] = useState(false)
  const [ideasError, setIdeasError] = useState('')

  // Auto Refresh
  const [autoRefreshed, setAutoRefreshed] = useState(false)

  const myReelsRef = useRef(myReels)
  const competitorsRef = useRef(competitors)
  useEffect(() => { myReelsRef.current = myReels }, [myReels])
  useEffect(() => { competitorsRef.current = competitors }, [competitors])

  // ─── Load cache on mount ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      loadCache<{ reels: Reel[]; fetchedAt?: string }>('my_reels'),
      loadCache<{ accounts: Record<string, { reels: Reel[]; fetchedAt: string }> }>('competitors'),
    ]).then(([myCache, compCache]) => {
      if (myCache?.reels?.length) {
        setMyReels(myCache.reels)
        setMyLastSynced(myCache.fetchedAt ?? null)
        setMyScrapeState('done')
      }
      if (compCache?.accounts) {
        const reels: Record<string, Reel[]> = {}
        const synced: Record<string, string> = {}
        for (const [u, { reels: userReels, fetchedAt }] of Object.entries(compCache.accounts)) {
          reels[u] = userReels
          synced[u] = fetchedAt
        }
        setCompetitors(reels)
        setCompLastSynced(synced)
      }
      setCacheLoading(false)
    })
  }, [])

  // ─── Fetch my reels ───────────────────────────────────────────────────────
  const fetchMyReels = useCallback(async () => {
    setMyError('')
    try {
      const reels = await startAndWait(MY_URL, 30, setMyScrapeState)
      const now = new Date().toISOString()
      setMyReels(reels)
      setMyLastSynced(now)
      setMyScrapeState('done')
      await saveCache('my_reels', { reels, fetchedAt: now })
    } catch (e: unknown) {
      setMyError(e instanceof Error ? e.message : String(e))
      setMyScrapeState('error')
    }
  }, [])

  // ─── Fetch a single competitor ────────────────────────────────────────────
  const fetchCompetitor = useCallback(async (username: string) => {
    const url = `https://www.instagram.com/${username}/`
    setScrapingUsernames((prev) => new Set(Array.from(prev).concat(username)))
    setCompErrors((prev) => { const n = { ...prev }; delete n[username]; return n })
    try {
      const reels = await startAndWait(url, 15, () => {})
      const now = new Date().toISOString()
      setCompetitors((prev) => {
        const updated = { ...prev, [username]: reels }
        const accounts: Record<string, { reels: Reel[]; fetchedAt: string }> = {}
        for (const [u, r] of Object.entries(updated)) {
          accounts[u] = { reels: r, fetchedAt: compLastSynced[u] ?? now }
        }
        accounts[username] = { reels, fetchedAt: now }
        saveCache('competitors', { accounts })
        return updated
      })
      setCompLastSynced((prev) => ({ ...prev, [username]: now }))
    } catch (e: unknown) {
      setCompErrors((prev) => ({ ...prev, [username]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setScrapingUsernames((prev) => { const n = new Set(Array.from(prev)); n.delete(username); return n })
    }
  }, [compLastSynced])

  const addCompetitor = useCallback(() => {
    const clean = newUsername.replace('@', '').trim().toLowerCase()
    if (!clean) return
    setNewUsername('')
    if (!competitors[clean]) fetchCompetitor(clean)
  }, [newUsername, competitors, fetchCompetitor])

  const removeCompetitor = useCallback((username: string) => {
    setCompetitors((prev) => {
      const updated = { ...prev }
      delete updated[username]
      const accounts: Record<string, { reels: Reel[]; fetchedAt: string }> = {}
      for (const [u, r] of Object.entries(updated)) {
        accounts[u] = { reels: r, fetchedAt: compLastSynced[u] ?? '' }
      }
      saveCache('competitors', { accounts })
      return updated
    })
    setCompLastSynced((prev) => { const n = { ...prev }; delete n[username]; return n })
  }, [compLastSynced])

  // ─── Transcribe ───────────────────────────────────────────────────────────
  const handleTranscribe = useCallback(async (reel: Reel) => {
    if (!reel.audioUrl) return
    setTranscribingId(reel.id)
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: reel.audioUrl }),
      })
      const data = await res.json()
      if (data.transcript) {
        setMyReels((prev) => {
          const updated = prev.map((r) => r.id === reel.id ? { ...r, transcript: data.transcript } : r)
          saveCache('my_reels', { reels: updated, fetchedAt: myLastSynced })
          return updated
        })
      }
    } finally {
      setTranscribingId(null)
    }
  }, [myLastSynced])

  const myFilteredTypeReels = (Array.isArray(myReels) ? myReels : []).filter(r => contentType === 'all' ? true : contentType === 'video' ? r.type === 'Video' : r.type !== 'Video')
  const filteredReels = perfFilter === 'all' ? myFilteredTypeReels : myFilteredTypeReels.filter((r) => r.performance === perfFilter)

  const competitorsFilteredType: Record<string, Reel[]> = {}
  Object.entries(competitors || {}).forEach(([u, r]) => {
    if (Array.isArray(r)) {
      competitorsFilteredType[u] = r.filter(reel => 
        contentType === 'all' ? true : contentType === 'video' ? reel.type === 'Video' : reel.type !== 'Video'
      )
    }
  })
  const competitorUsernames = Object.keys(competitorsFilteredType)

  // ─── Generate ideas (Puter.js Integration) ───────────────────────────────
  const generateIdeas = useCallback(async () => {
    setIdeasLoading(true)
    setIdeasError('')
    try {
      const label = contentType === 'video' ? 'Reels' : contentType === 'post' ? 'Posts' : 'Content'
      
      const formatMetric = (r: Reel) => {
        if (contentType === 'video') return r.views ? `${r.views.toLocaleString()} views` : `${r.likes.toLocaleString()} likes`
        return `${r.likes.toLocaleString()} likes`
      }

      // 1. Build competitor context
      const competitorContext = Object.entries(competitorsFilteredType)
        .map(([username, reels]) => {
          if (!reels?.length) return null
          const sorted = [...reels].sort((a, b) => contentType === 'post' ? b.likes - a.likes : b.views - a.views || b.likes - a.likes)
          const top5 = sorted.slice(0, 5).map((r, i) => {
            const metric = formatMetric(r)
            const type = r.type === 'Video' ? 'Reel' : 'Post'
            return `  ${i + 1}. [${type}] ${metric} | Caption: "${r.caption.slice(0, 200).replace(/\n/g, ' ')}"`
          }).join('\n')
          return `@${username} top performers:\n${top5}`
        })
        .filter(Boolean)
        .join('\n\n')

      // 2. Build my context
      const myTop = [...myFilteredTypeReels]
        .sort((a, b) => contentType === 'post' ? b.likes - a.likes : b.views - a.views || b.likes - a.likes)
        .slice(0, 5)
        .map((r, i) => `  ${i + 1}. ${formatMetric(r)} | "${r.caption.slice(0, 150).replace(/\n/g, ' ')}"`).join('\n')

      const prompt = `You are an elite Instagram growth strategist for @nivixpe (fintech startup).
      
      GOAL: Analyze our content vs competitors and tell us EXACTLY what we are missing.
      
      ## MY PERFORMANCE DATA (@nivixpe)
      ${myTop || '(No data available for my account yet)'}
      
      ## COMPETITOR PERFORMANCE DATA
      ${competitorContext || '(No competitor data available - provide generic high-growth fintech patterns)'}
      
      ## YOUR TASK (COMPARATIVE ANALYSIS)
      
      ### 1. 🔍 THE COMPARISON
      Compare the hooks and themes of @nivixpe's top content vs the competitor's top performers. What is the biggest difference in their approach?
      
      ### 2. 🎯 WHAT IS MISSING?
      List 3 specific content types, visual styles, or topics that are generating high engagement for competitors but are COMPLETELY MISSING from @nivixpe's profile.
      
      ### 3. 💡 COMPARED IDEAS
      Suggest 5 specific ${label} ideas that bridge the gap. For each idea, explain which competitor it was inspired by and why it will work for @nivixpe.
      Include: Hook, Visual Structure, and the specific "Viral Trigger" from the competitor.
      
      ### 4. 🏆 THE "WIN" INSIGHT
      One single change to make to our content today that will close the gap with the top competitors.
      
      Be data-driven and reference competitor handles (@username) often. Be brutal about what we are missing.`

      // Use Puter.js for free unlimited OpenAI (GPT-4o)
      const response = await puter.ai.chat(prompt, { model: 'gpt-4o' })
      setIdeas(String(response))
    } catch (e: any) {
      setIdeasError(e.message || 'Puter.js failed to generate ideas')
    } finally {
      setIdeasLoading(false)
    }
  }, [myFilteredTypeReels, competitorsFilteredType, contentType])

  // ─── Tab navigation ───────────────────────────────────────────────────────
  const handleTabChange = (newTab: Tab) => {
    if (newTab === tab) return
    setTabAnimating(true)
    setTimeout(() => {
      setTab(newTab)
      setTabAnimating(false)
    }, 150)
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'mine', label: contentType === 'all' ? 'All Content' : contentType === 'video' ? 'My Reels' : 'My Posts', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'competitors', label: 'Competitors', icon: <Users2 className="w-4 h-4" /> },
    { id: 'compare', label: 'Compare', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'ideas', label: 'Content Ideas', icon: <Lightbulb className="w-4 h-4" /> },
  ]

  // ─── Auto-update when data is older than 24h ──────────────────────────────
  useEffect(() => {
    if (cacheLoading || autoRefreshed) return
    setAutoRefreshed(true)

    const now = Date.now()
    const isStale = (isoDate?: string | null) => !isoDate || (now - new Date(isoDate).getTime() > 24 * 60 * 60 * 1000)

    if (myLastSynced && isStale(myLastSynced) && myScrapeState === 'idle') {
      fetchMyReels()
    }
    for (const [u, syncDate] of Object.entries(compLastSynced)) {
      if (isStale(syncDate) && !scrapingUsernames.has(u)) {
        fetchCompetitor(u)
      }
    }
  }, [cacheLoading, autoRefreshed, myLastSynced, myScrapeState, compLastSynced, scrapingUsernames, fetchMyReels, fetchCompetitor])

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-surface-950)' }}>
      {/* ═══════════════ HEADER ═══════════════ */}
      <header className="border-b border-[#1de9b6]/8 sticky top-0 z-50" style={{ background: 'rgba(5,8,17,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Logo */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-105" style={{ background: 'rgba(29,233,182,0.12)', border: '1px solid rgba(29,233,182,0.25)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 17C3 17 5 10 12 7C19 4 21 7 21 7C21 7 16 8 13 12C10 16 12 20 12 20C12 20 8 19 6 16L3 17Z" fill="#1de9b6" opacity="0.9"/>
                <path d="M12 20C12 20 14 16 17 14C20 12 22 13 22 13C22 13 20 16 17 18C14 20 12 20 12 20Z" fill="#1de9b6" opacity="0.5"/>
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">NIVIXPE</h1>
              <p className="text-[11px] font-medium" style={{ color: '#1de9b6', opacity: 0.6 }}>@nivixpe · Content Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Content Toggle */}
            <div className="hidden md:flex bg-slate-800/60 rounded-xl p-1 border border-slate-700/40">
              {(['all', 'video', 'post'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setContentType(type)}
                  className={clsx(
                    'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                    contentType === type
                      ? 'bg-slate-700 text-white shadow-lg'
                      : 'text-slate-500 hover:text-slate-300'
                  )}
                >
                  {type === 'all' ? 'All' : type === 'video' ? 'Reels' : 'Posts'}
                </button>
              ))}
            </div>

            {/* Tabs */}
            <nav className="flex items-center gap-0.5 rounded-xl p-1" style={{ background: 'rgba(29,233,182,0.05)', border: '1px solid rgba(29,233,182,0.1)' }}>
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTabChange(t.id)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
                    tab === t.id
                      ? 'text-[#1de9b6] shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                  )}
                  style={tab === t.id ? { background: 'rgba(29,233,182,0.12)' } : {}}
                >
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <div className={clsx('max-w-7xl mx-auto px-4 sm:px-6 py-8 transition-all duration-300', tabAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0')}>

        {/* ══ MY REELS ══════════════════════════════════════════════════════════ */}
        {tab === 'mine' && (
          <div>
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-5 h-5 text-[#1de9b6]" />
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {contentType === 'all' ? 'All Content' : contentType === 'video' ? 'My Reels' : 'My Posts'}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-slate-500 text-sm">Last 30 days · @nivixpe</p>
                  {myLastSynced && (
                    <span className="flex items-center gap-1 text-xs text-slate-600">
                      <Clock className="w-3 h-3" /> {timeAgo(myLastSynced)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={fetchMyReels}
                disabled={['starting', 'polling', 'fetching'].includes(myScrapeState)}
                className="flex items-center gap-2 font-bold text-sm px-5 py-2.5 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed btn-press shadow-lg shadow-[#1de9b6]/10 hover:shadow-xl hover:shadow-[#1de9b6]/20"
                style={{ background: '#1de9b6', color: '#080b11' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#0fb98f')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1de9b6')}
              >
                <RefreshCw className={clsx('w-4 h-4', myScrapeState === 'polling' && 'animate-spin')} />
                {myLastSynced ? 'Re-sync' : 'Fetch Reels'}
              </button>
            </div>

            {myScrapeState === 'error' && (
              <div className="flex items-start gap-3 bg-rose-500/8 border border-rose-500/20 text-rose-300 rounded-xl p-4 mb-6 text-sm animate-fade-in-up">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{myError}</span>
              </div>
            )}

            {['starting', 'polling', 'fetching'].includes(myScrapeState) && (
              <ScrapeProgress message={SCRAPE_MSG[myScrapeState]} subtext="Apify is scraping your Instagram profile…" />
            )}

            {cacheLoading && myReels.length === 0 && (
              <>
                <StatSkeleton />
                <div className="rounded-xl border border-slate-700/30 bg-slate-800/30 p-5 mb-8">
                  <div className="w-40 h-4 rounded skeleton mb-4" />
                  <div className="w-full h-56 rounded skeleton" />
                </div>
                <ReelSkeletonGrid />
              </>
            )}

            {myReels.length > 0 && !['starting', 'polling', 'fetching'].includes(myScrapeState) && (
              <>
                <MetricsOverview reels={myFilteredTypeReels} contentType={contentType} />
                <PerformanceChart reels={myFilteredTypeReels} contentType={contentType} />

                {/* Filter bar */}
                <div className="flex items-center gap-2 mb-5">
                  <Filter className="w-4 h-4 text-slate-500" />
                  {(['all', 'top', 'mid', 'low'] as PerfFilter[]).map((f) => {
                    const count = f === 'all' ? myFilteredTypeReels.length : myFilteredTypeReels.filter((r) => r.performance === f).length
                    return (
                      <button
                        key={f}
                        onClick={() => setPerfFilter(f)}
                        className={clsx(
                          'text-xs px-3.5 py-1.5 rounded-xl border transition-all duration-200 font-semibold',
                          perfFilter === f
                            ? f === 'top' ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                              : f === 'low' ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-sm'
                              : f === 'mid' ? 'bg-violet-500/15 border-violet-500/40 text-violet-300 shadow-sm'
                              : 'bg-slate-700 border-slate-600 text-white shadow-sm'
                            : 'border-slate-700/50 text-slate-500 hover:border-slate-600 hover:text-slate-400',
                        )}
                      >
                        {f === 'all' ? 'All' : f === 'top' ? 'Top' : f === 'mid' ? 'Average' : 'Low'} ({count})
                      </button>
                    )
                  })}
                </div>

                {/* Reels grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredReels.map((reel, i) => (
                    <ReelCard key={reel.id} reel={reel} onTranscribe={handleTranscribe} transcribing={transcribingId === reel.id} index={i} />
                  ))}
                </div>
                {filteredReels.length === 0 && (
                  <div className="text-center py-16 border border-dashed border-slate-700/50 rounded-2xl animate-fade-in">
                    <Filter className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-white font-semibold mb-2">No matches</h3>
                    <p className="text-slate-500 text-sm">No reels match this filter. Try another.</p>
                  </div>
                )}
              </>
            )}

            {myScrapeState === 'idle' && myReels.length === 0 && !cacheLoading && (
              <div className="text-center py-24 border border-dashed border-slate-700/50 rounded-2xl animate-fade-in-up">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-5">
                  <LayoutDashboard className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">No data yet</h3>
                <p className="text-slate-500 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                  Fetch your last 30 days of content. Results are cached locally — no re-scrape needed on refresh.
                </p>
                <button
                  onClick={fetchMyReels}
                  className="font-bold text-sm px-8 py-3 rounded-xl transition-all duration-300 shadow-lg shadow-[#1de9b6]/10 hover:shadow-xl hover:shadow-[#1de9b6]/20 btn-press"
                  style={{ background: '#1de9b6', color: '#080b11' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#0fb98f')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#1de9b6')}
                >
                  Fetch My Content
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ COMPETITORS ═══════════════════════════════════════════════════════ */}
        {tab === 'competitors' && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users2 className="w-5 h-5 text-[#1de9b6]" />
              <h2 className="text-xl font-bold text-white tracking-tight">Competitors</h2>
            </div>
            <p className="text-slate-500 text-sm mb-6">Add any Instagram username to scrape their content</p>

            {/* Add competitor input */}
            <div className="flex gap-3 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
                  placeholder="username"
                  className="w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#1de9b6]/30 focus:ring-2 focus:ring-[#1de9b6]/10 placeholder:text-slate-600 transition-all"
                />
              </div>
              <button
                onClick={addCompetitor}
                disabled={!newUsername.trim()}
                className="flex items-center gap-2 font-bold text-sm px-5 py-2.5 rounded-xl transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed btn-press"
                style={{ background: 'rgba(29,233,182,0.12)', color: '#1de9b6', border: '1px solid rgba(29,233,182,0.25)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(29,233,182,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(29,233,182,0.12)'; }}
              >
                <Plus className="w-4 h-4" /> Add & Scrape
              </button>
            </div>

            {/* Empty state */}
            {competitorUsernames.length === 0 && Array.from(scrapingUsernames).length === 0 && (
              <div className="text-center py-20 border border-dashed border-slate-700/50 rounded-2xl animate-fade-in-up">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-5">
                  <Users2 className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">No competitors added</h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed mb-4">
                  Type a username above and click &quot;Add & Scrape&quot;. Try <span className="text-violet-400 font-semibold">nateherk</span> or <span className="text-violet-400 font-semibold">nick_saraev</span>
                </p>
                <div className="flex gap-2 justify-center">
                  {['nateherk', 'nick_saraev'].map((u) => (
                    <button
                      key={u}
                      onClick={() => { setNewUsername(u); }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition-all"
                    >
                      @{u}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* In-progress scrapes */}
            {Array.from(scrapingUsernames).map((username) => (
              <div key={username} className="mb-4 rounded-xl border border-violet-500/15 bg-violet-500/[0.04] p-5 animate-fade-in-up">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  <span className="text-sm text-violet-300 font-semibold">Scraping @{username}…</span>
                  <span className="text-xs text-slate-500">Apify is fetching their reels (1–3 min)</span>
                </div>
              </div>
            ))}

            {/* Competitor sections */}
            {competitorUsernames.length > 0 && (
              <div className="space-y-6">
                {competitorUsernames.map((username, i) => (
                  <div key={username} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {compLastSynced[username] && (
                          <span className="flex items-center gap-1 text-xs text-slate-600">
                            <Clock className="w-3 h-3" /> {timeAgo(compLastSynced[username])}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => fetchCompetitor(username)}
                          disabled={scrapingUsernames.has(username)}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#1de9b6] transition-colors disabled:opacity-40 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60"
                        >
                          <RefreshCw className={clsx('w-3 h-3', scrapingUsernames.has(username) && 'animate-spin')} />
                          Re-sync
                        </button>
                        <button
                          onClick={() => removeCompetitor(username)}
                          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-rose-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10"
                        >
                          <X className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>
                    {compErrors[username] && (
                      <div className="flex items-start gap-2 bg-rose-500/8 border border-rose-500/20 text-rose-300 rounded-xl p-3 mb-3 text-xs animate-fade-in">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        {compErrors[username]}
                      </div>
                    )}
                    <CompetitorSection username={username} reels={competitorsFilteredType[username] ?? []} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ COMPARE ═══════════════════════════════════════════════════════════ */}
        {tab === 'compare' && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GitCompare className="w-5 h-5 text-[#1de9b6]" />
              <h2 className="text-xl font-bold text-white tracking-tight">Compare</h2>
            </div>
            <p className="text-slate-500 text-sm mb-6">Me vs competitors — what&apos;s working, what&apos;s not, content gaps</p>
            <ComparisonView myReels={myFilteredTypeReels} competitors={competitorsFilteredType} contentType={contentType} />
          </div>
        )}

        {/* ══ CONTENT IDEAS ════════════════════════════════════════════════════ */}
        {tab === 'ideas' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb className="w-5 h-5 text-[#1de9b6]" />
                  <h2 className="text-xl font-bold text-white tracking-tight">Content Ideas</h2>
                </div>
                <p className="text-slate-500 text-sm">AI strategy based on your performance + competitor data</p>
              </div>
              <button
                onClick={generateIdeas}
                disabled={ideasLoading}
                className="flex items-center gap-2 font-bold text-sm px-5 py-2.5 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed btn-press shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:shadow-emerald-500/20"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}
              >
                {ideasLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Sparkles className="w-4 h-4" /> {ideas ? 'Regenerate' : 'Generate Ideas'}</>
                }
              </button>
            </div>


            {/* Warnings */}
            {((myReels || []).length === 0 || competitorUsernames.length === 0) && (
              <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 text-amber-300 rounded-xl p-4 mb-6 text-sm animate-fade-in-up">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  {(myReels || []).length === 0 && 'Fetch your reels first (My Reels tab). '}
                  {competitorUsernames.length === 0 && 'Add competitors (Competitors tab) for better ideas.'}
                </span>
              </div>
            )}

            {ideasError && (
              <div className="flex items-start gap-3 bg-rose-500/8 border border-rose-500/20 text-rose-300 rounded-xl p-4 mb-6 text-sm animate-fade-in-up">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{ideasError}</span>
              </div>
            )}

            {ideasLoading && (
              <ScrapeProgress 
                message={`Analyzing your ${contentType === 'all' ? 'content' : contentType === 'video' ? 'Reels' : 'Posts'} + competitors…`} 
                subtext={`Unlimited GPT-4o via Puter.js is reviewing your ${contentType === 'all' ? 'data' : contentType === 'video' ? 'video performance' : 'image/carousel metrics'} and generating a strategy`} 
              />
            )}

            {/* Ideas result */}
            {ideas && !ideasLoading && (
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-6 animate-fade-in-up">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-sm font-bold text-emerald-300">
                      {contentType === 'all' ? 'Unified' : contentType === 'video' ? 'Reels-Focused' : 'Post-Focused'} Strategy Report
                    </span>
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50">
                    {contentType}
                  </div>
                </div>
                <div className="space-y-1">
                  {ideas.split('\n').map((line, i) => {
                    if (!line.trim()) return <div key={i} className="h-3" />
                    if (line.match(/^#{1,3}\s/) || line.match(/^\*\*.*\*\*$/)) {
                      const clean = line.replace(/\*\*/g, '').replace(/^#{1,3}\s/, '')
                      return (
                        <h3 key={i} className="text-base font-bold text-white mt-6 mb-3 flex items-center gap-2">
                          <ChevronRight className="w-4 h-4 text-emerald-400" />
                          {clean}
                        </h3>
                      )
                    }
                    if (line.match(/^\d+\.\s/)) {
                      return (
                        <div key={i} className="flex gap-3 text-slate-300 text-sm py-1.5 pl-2">
                          <span className="text-emerald-400 font-bold flex-shrink-0">{line.match(/^\d+/)?.[0]}.</span>
                          <span dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s/, '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                        </div>
                      )
                    }
                    if (line.startsWith('- ') || line.startsWith('• ')) {
                      return (
                        <div key={i} className="flex gap-2.5 text-slate-300 text-sm py-1 pl-2">
                          <span className="text-emerald-400 flex-shrink-0 mt-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                          </span>
                          <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                        </div>
                      )
                    }
                    return (
                      <p key={i} className="text-slate-300 text-sm leading-relaxed py-1"
                        dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {!ideas && !ideasLoading && (
              <div className="text-center py-24 border border-dashed border-slate-700/50 rounded-2xl animate-fade-in-up">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-5">
                  <Lightbulb className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">No {contentType === 'all' ? 'ideas' : contentType === 'video' ? 'Reel ideas' : 'Post ideas'} yet</h3>
                <p className="text-slate-500 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                  Click &quot;Generate Ideas&quot; — GPT-4o will analyze your {contentType === 'all' ? 'performance' : contentType === 'video' ? 'top Reels' : 'top Posts'} vs competitors and tell you exactly what to make next.
                </p>
                <button
                  onClick={generateIdeas}
                  className="font-bold text-sm px-8 py-3 rounded-xl transition-all duration-300 shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:shadow-emerald-500/20 btn-press"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}
                >
                  Generate {contentType === 'all' ? '' : contentType === 'video' ? 'Reel' : 'Post'} Ideas
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
