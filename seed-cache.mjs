/**
 * Seed the local dashboard cache from a signed Apify dataset URL.
 * Usage: node seed-cache.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DATASET_URL =
  'https://api.apify.com/v2/datasets/0ZCyox2gQCy4dh9Z3/items?signature=MC4xNzc4NDIyMzA0MzA4LnVKTGZTQlpNdVdqU1pncWRnN3RU&format=json&clean=true'

function tagPerformance(reels) {
  if (reels.length === 0) return reels
  const avg = reels.reduce((s, r) => s + r.views, 0) / reels.length
  return reels.map((r) => ({
    ...r,
    performance: r.views >= avg * 1.4 ? 'top' : r.views < avg * 0.6 ? 'low' : 'mid',
  }))
}

function transformItem(item) {
  // likes: -1 means hidden by Instagram; treat as 0
  const likes = item.likesCount > 0 ? item.likesCount : 0
  // views: use videoPlayCount if present, else 0 (image posts have no views)
  const views = item.videoPlayCount > 0 ? item.videoPlayCount : 0
  const comments = item.commentsCount ?? 0
  // thumbnail: use displayUrl from item or first child post
  const thumbnailUrl =
    item.displayUrl ||
    (item.images && item.images[0]) ||
    (item.childPosts && item.childPosts[0]?.displayUrl) ||
    undefined

  return {
    id: String(item.id ?? item.shortCode ?? Math.random()),
    url: item.url ?? '',
    timestamp: item.timestamp ?? new Date().toISOString(),
    likes,
    views,
    comments,
    caption: (item.caption ?? '').slice(0, 600),
    thumbnailUrl,
    ownerUsername: item.ownerUsername ?? 'nivixpe',
    audioUrl: item.audioUrl ?? undefined,
    videoUrl: item.videoUrl ?? undefined,
    duration: item.videoDuration ?? undefined,
  }
}

async function main() {
  console.log('📥 Fetching Apify dataset…')
  const res = await fetch(DATASET_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const items = await res.json()
  console.log(`✅ Got ${items.length} items from Apify`)

  const reels = items.map(transformItem)
  const tagged = tagPerformance(reels)

  const dataDir = path.join(__dirname, 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  const cachePayload = {
    reels: tagged,
    fetchedAt: new Date().toISOString(),
  }

  const outFile = path.join(dataDir, 'my_reels.json')
  fs.writeFileSync(outFile, JSON.stringify(cachePayload, null, 2), 'utf-8')

  console.log(`💾 Saved to ${outFile}`)
  console.log(`📊 Posts: ${tagged.length}`)
  tagged.forEach((r, i) => {
    console.log(
      `  ${i + 1}. [${r.performance?.toUpperCase()}] ${r.caption.slice(0, 60).replace(/\n/g, ' ')}… | views: ${r.views} | likes: ${r.likes} | comments: ${r.comments}`
    )
  })
  console.log('\n🚀 Refresh the dashboard at http://localhost:3001 to see your posts!')
}

main().catch((e) => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
