/**
 * Standalone Node.js script to automatically update the Instagram dashboard cache.
 * You can schedule this to run daily (e.g., via Windows Task Scheduler or cron).
 * 
 * Requirements:
 * 1. You must have an APIFY_TOKEN set in your .env.local file.
 * 2. Run: npm install dotenv
 * 3. Run script: node update-live.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

// Load environment variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '.env.local') })

const APIFY_TOKEN = process.env.APIFY_TOKEN
const ACTOR_ID = 'shu8hvrXbJbY3Eb9W'
const BASE = 'https://api.apify.com/v2'

if (!APIFY_TOKEN || APIFY_TOKEN === 'your_apify_token_here') {
  console.error('❌ Error: APIFY_TOKEN is missing or invalid in .env.local')
  console.error('Please add your actual Apify token to scrape live data.')
  process.exit(1)
}

const MY_URL = 'https://www.instagram.com/nivixpe/'
const COMPETITORS = ['wiseaccount', 'revolut']

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function tagPerformance(items) {
  if (items.length === 0) return items

  const videos = items.filter(i => i.type === 'Video')
  const posts = items.filter(i => i.type !== 'Video')

  const tag = (list, metric) => {
    if (list.length === 0) return list
    const avg = list.reduce((s, r) => s + r[metric], 0) / list.length
    if (avg === 0) return list.map(r => ({ ...r, performance: 'mid' }))
    return list.map(r => ({
      ...r,
      performance: r[metric] >= avg * 1.4 ? 'top' : r[metric] < avg * 0.6 ? 'low' : 'mid'
    }))
  }

  return [...tag(videos, 'views'), ...tag(posts, 'likes')].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

async function startAndWait(url, limit = 30) {
  console.log(`\n🚀 Starting Apify scraper for ${url}...`)
  const res = await fetch(`${BASE}/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directUrls: [url],
      resultsType: 'posts',
      resultsLimit: limit,
      addParentData: false,
    }),
  })
  if (!res.ok) throw new Error(`Apify start failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const runId = data.data.id
  const datasetId = data.data.defaultDatasetId

  console.log(`⏱️ Run started (${runId}). Polling status...`)
  
  for (let i = 0; i < 60; i++) {
    await wait(5000)
    const statusRes = await fetch(`${BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`)
    const statusData = await statusRes.json()
    const status = statusData.data.status
    
    if (status === 'SUCCEEDED') {
      console.log(`✅ Run succeeded! Fetching results...`)
      break
    }
    if (status === 'FAILED' || status === 'ABORTED') {
      throw new Error(`Run failed with status: ${status}`)
    }
    process.stdout.write('.')
  }

  const resultsRes = await fetch(`${BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json&clean=true`)
  const items = await resultsRes.json()

  return items.map((item) => ({
    id: String(item.id ?? item.shortCode ?? item.url ?? Math.random()),
    url: item.url ?? '',
    timestamp: item.timestamp ?? new Date().toISOString(),
    likes: Number(item.likesCount ?? item.likeCount ?? item.likes ?? 0),
    views: Number(item.videoPlayCount ?? item.videoViewCount ?? item.playCount ?? item.viewCount ?? 0),
    comments: Number(item.commentsCount ?? item.commentCount ?? item.comments ?? 0),
    caption: String(item.caption ?? '').slice(0, 600),
    audioUrl: item.audioUrl,
    videoUrl: item.videoUrl,
    thumbnailUrl: item.displayUrl ?? item.thumbnailUrl,
    duration: item.videoDuration,
    ownerUsername: item.ownerUsername ?? '',
    type: item.type ?? 'Video',
  }))
}

async function main() {
  const dataDir = path.join(__dirname, 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  const now = new Date().toISOString()

  // 1. Fetch My Reels
  try {
    const myRaw = await startAndWait(MY_URL, 30)
    const myReels = tagPerformance(myRaw)
    const outFile = path.join(dataDir, 'my_reels.json')
    fs.writeFileSync(outFile, JSON.stringify({ reels: myReels, fetchedAt: now }, null, 2), 'utf-8')
    console.log(`💾 Saved ${myReels.length} posts for ${MY_URL} to my_reels.json`)
  } catch (err) {
    console.error(`❌ Failed to fetch my reels: ${err.message}`)
  }

  // 2. Fetch Competitors
  const compCachePath = path.join(dataDir, 'competitors.json')
  let compCache = { accounts: {} }
  if (fs.existsSync(compCachePath)) {
    compCache = JSON.parse(fs.readFileSync(compCachePath, 'utf-8'))
  }

  for (const comp of COMPETITORS) {
    try {
      const url = `https://www.instagram.com/${comp}/`
      const raw = await startAndWait(url, 30)
      const reels = tagPerformance(raw)
      compCache.accounts[comp] = { reels, fetchedAt: now }
      console.log(`💾 Saved ${reels.length} posts for @${comp}`)
    } catch (err) {
      console.error(`❌ Failed to fetch competitor @${comp}: ${err.message}`)
    }
  }

  fs.writeFileSync(compCachePath, JSON.stringify(compCache, null, 2), 'utf-8')
  console.log(`\n🎉 Update complete! Dashboard cache is now fresh.`)
}

main().catch(console.error)
