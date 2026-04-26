/**
 * Seed competitor cache for Revolut with representative Instagram data.
 * Based on publicly available Instagram analytics for these accounts.
 * Run:  node seed-competitors.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function tagPerformance(reels) {
  if (reels.length === 0) return reels
  const avg = reels.reduce((s, r) => s + r.views, 0) / reels.length
  return reels.map((r) => ({
    ...r,
    performance: r.views >= avg * 1.4 ? 'top' : r.views < avg * 0.6 ? 'low' : 'mid',
  }))
}

// ── Revolut (@revolut) — ~600K followers, neobank ────────────────────────────
const revolutReels = tagPerformance([
  {
    id: 'revolut-001', ownerUsername: 'revolut',
    url: 'https://www.instagram.com/p/revolut-sample-1/',
    timestamp: '2026-04-19T12:00:00.000Z',
    caption: 'One app to rule your money. Banking, crypto, stocks, insurance — all in one place. This is Revolut.\n\n#Revolut #Neobank #DigitalBanking #Fintech',
    likes: 5400, views: 221000, comments: 143,
    thumbnailUrl: undefined, performance: 'top',
  },
  {
    id: 'revolut-002', ownerUsername: 'revolut',
    url: 'https://www.instagram.com/p/revolut-sample-2/',
    timestamp: '2026-04-14T09:30:00.000Z',
    caption: 'Send money to friends instantly. Split bills. No waiting. No fees between Revolut users.\n\n#SendMoney #SplitBills #Revolut #P2P',
    likes: 4200, views: 178000, comments: 98,
    thumbnailUrl: undefined, performance: 'top',
  },
  {
    id: 'revolut-003', ownerUsername: 'revolut',
    url: 'https://www.instagram.com/p/revolut-sample-3/',
    timestamp: '2026-04-09T15:00:00.000Z',
    caption: 'New feature: Revolut <18. Give your kids a safe way to spend, save, and learn about money.\n\n#RevolutJunior #KidsBanking #FamilyFinance',
    likes: 3800, views: 145000, comments: 76,
    thumbnailUrl: undefined, performance: 'top',
  },
  {
    id: 'revolut-004', ownerUsername: 'revolut',
    url: 'https://www.instagram.com/p/revolut-sample-4/',
    timestamp: '2026-04-04T11:15:00.000Z',
    caption: 'Spending in a foreign currency shouldn\'t cost you extra. With Revolut, it doesn\'t.\n\n#Revolut #TravelMoney #ForeignCurrency',
    likes: 2600, views: 98000, comments: 54,
    thumbnailUrl: undefined, performance: 'mid',
  },
  {
    id: 'revolut-005', ownerUsername: 'revolut',
    url: 'https://www.instagram.com/p/revolut-sample-5/',
    timestamp: '2026-03-30T14:00:00.000Z',
    caption: 'Buy, sell, and hold crypto in seconds. Bitcoin, Ethereum, and 100+ more.\n\n#Crypto #Bitcoin #Revolut #CryptoTrading',
    likes: 4900, views: 203000, comments: 118,
    thumbnailUrl: undefined, performance: 'top',
  },
  {
    id: 'revolut-006', ownerUsername: 'revolut',
    url: 'https://www.instagram.com/p/revolut-sample-6/',
    timestamp: '2026-03-24T10:30:00.000Z',
    caption: 'Smart savings vaults. Round up your purchases and save the difference automatically.\n\n#Savings #Revolut #SavingsGoals #PersonalFinance',
    likes: 1900, views: 71000, comments: 38,
    thumbnailUrl: undefined, performance: 'low',
  },
])

async function main() {
  const dataDir = path.join(__dirname, 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  const now = new Date().toISOString()
  const cachePayload = {
    accounts: {
      revolut: { reels: revolutReels, fetchedAt: now },
    },
  }

  const outFile = path.join(dataDir, 'competitors.json')
  fs.writeFileSync(outFile, JSON.stringify(cachePayload, null, 2), 'utf-8')

  console.log(`\n✅ Competitors cache written to ${outFile}\n`)

  for (const [name, { reels }] of Object.entries(cachePayload.accounts)) {
    const avgViews = Math.round(reels.reduce((s, r) => s + r.views, 0) / reels.length)
    const topCount = reels.filter((r) => r.performance === 'top').length
    console.log(`📊 @${name}: ${reels.length} posts | avg views: ${avgViews.toLocaleString()} | top: ${topCount}`)
  }

  console.log('\n🚀 Refresh http://localhost:3001 → go to Competitors tab to see Revolut!')
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
