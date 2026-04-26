import type { Reel } from './types'

const APIFY_TOKEN = process.env.APIFY_TOKEN ?? ''
const ACTOR_ID = 'shu8hvrXbJbY3Eb9W'
const BASE = 'https://api.apify.com/v2'

export async function startScrapeRun(instagramUrl: string, limit = 30) {
  const res = await fetch(`${BASE}/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directUrls: [instagramUrl],
      resultsType: 'posts',
      resultsLimit: limit,
      addParentData: false,
    }),
  })
  if (!res.ok) throw new Error(`Apify start failed: ${res.status}`)
  const data = await res.json()
  return {
    runId: data.data.id as string,
    datasetId: data.data.defaultDatasetId as string,
  }
}

export async function getRunStatus(runId: string): Promise<string> {
  const res = await fetch(`${BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`)
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`)
  const data = await res.json()
  return data.data.status as string
}

export async function fetchResults(datasetId: string, limit = 30): Promise<Reel[]> {
  const res = await fetch(
    `${BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}&format=json`
  )
  if (!res.ok) throw new Error(`Results fetch failed: ${res.status}`)
  const items = await res.json()

  return (items as Record<string, unknown>[]).map((item) => ({
    id: (item.id ?? item.shortCode ?? item.url ?? String(Math.random())) as string,
    url: item.url as string ?? '',
    timestamp: item.timestamp as string ?? '',
    likes: Number(((item.likesCount as number) ?? 0) > 0 ? item.likesCount : 0),
    views: Number(((item.videoPlayCount as number) ?? 0) > 0 ? item.videoPlayCount : 0),
    comments: Number(item.commentsCount ?? 0),
    caption: (item.caption as string ?? '').slice(0, 600),
    audioUrl: item.audioUrl as string | undefined,
    videoUrl: item.videoUrl as string | undefined,
    thumbnailUrl: (item.displayUrl ?? item.thumbnailUrl) as string | undefined,
    duration: item.videoDuration as number | undefined,
    ownerUsername: item.ownerUsername as string ?? '',
    type: item.type as string ?? 'Video',
  }))
}

export function tagPerformance(items: Reel[]): Reel[] {
  if (items.length === 0) return items

  const videos = items.filter(i => i.type === 'Video')
  const posts = items.filter(i => i.type !== 'Video')

  const tag = (list: Reel[], metric: 'views' | 'likes'): Reel[] => {
    if (list.length === 0) return list
    const avg = list.reduce((s, r) => s + r[metric], 0) / list.length
    if (avg === 0) return list.map(r => ({ ...r, performance: 'mid' as const }))
    return list.map(r => ({
      ...r,
      performance: (r[metric] >= avg * 1.4 ? 'top' : r[metric] < avg * 0.6 ? 'low' : 'mid') as 'top' | 'mid' | 'low'
    }))
  }

  return [...tag(videos, 'views'), ...tag(posts, 'likes')].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}
