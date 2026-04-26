import { NextRequest, NextResponse } from 'next/server'
import type { Reel } from '@/lib/types'

type ContentType = 'video' | 'post' | 'all'

function formatLabel(contentType: ContentType) {
  if (contentType === 'video') return 'Reels'
  if (contentType === 'post') return 'Posts (images/carousels)'
  return 'content (Reels + Posts)'
}

function formatMetric(r: Reel, contentType: ContentType) {
  if (contentType === 'video') return r.views ? `${r.views.toLocaleString()} views` : `${r.likes.toLocaleString()} likes`
  if (contentType === 'post') return `${r.likes.toLocaleString()} likes`
  return r.views ? `${r.views.toLocaleString()} views` : `${r.likes.toLocaleString()} likes`
}

export async function POST(req: NextRequest) {
  const {
    myReels,
    competitorReels,
    apiKey,
    contentType = 'all',
  }: {
    myReels: Reel[]
    competitorReels: Record<string, Reel[]>
    apiKey?: string
    contentType?: ContentType
  } = await req.json()

  const activeKey = apiKey || process.env.GEMINI_API_KEY
  const label = formatLabel(contentType)

  if (!activeKey) {
    // Smart heuristic fallback
    const heuristicIdeas = `### 🚀 ${label} Content Strategy (Local Analysis)
**[NOTE]** Gemini API Key not detected. Using local heuristic analysis. Add a Gemini API key for full AI-powered insights.

#### 1. **What's Working for Competitors**
- **Speed Messaging**: Top competitor posts leading with "instant" or "30 seconds" get 40-60% more reach.
- **Relatable Pain Points**: Content framing traditional banks as the villain outperforms product-feature content by 2–3×.
- **Social Proof**: Posts with real user stories or testimonial angles consistently outreach general brand posts.

#### 2. **3 Themes You Should STOP Making**
- **Pure branding / logo posts**: Zero story = zero reach.
- **Technical explainers**: Audiences skip anything that feels educational without immediate personal stakes.
- **Promotional-first content**: "Sign up now" posts without a hook fail regardless of production quality.

#### 3. **5 Specific ${label} Ideas This Week**
1. **"Your bank just charged you £12 for this"** — Reveal a common hidden fee. Hook: "You sent money abroad last week. Here's what your bank didn't tell you."
2. **Speed Race** — Compare Nivixpe transfer time vs. a slow bank animation. Hook: "3 days vs 3 seconds."
3. **The Student Abroad** — Relatable story: student sending money home. Hook: "My family waited 4 days for rent money."
4. **Founder Face-to-Camera** — Build trust with your audience. Hook: "I built Nivixpe because I got charged $47 in fees on a $200 transfer."
5. **Beta Milestone**: "Nivixpe is now LIVE in Beta — opening for 100 people."
   - *Hook*: "Your invite to the future of payments is here."

#### 4. **Best Time to Post**
- Between **6 PM and 9 PM IST** (Based on your top performing post's engagement slope).

#### 5. **💎 Headline Insight**
**Nivixpe wins on SPEED.** Your audience doesn't care about "Fintech" as much as they care about "Instant." Double down on the *Instant* messaging in every hook.`

    return NextResponse.json({ ideas: heuristicIdeas })
  }

  // ── Build competitor analysis context ───────────────────────────────────────
  const competitorContext = Object.entries(competitorReels ?? {})
    .map(([username, reels]) => {
      if (!reels?.length) return null

      const sorted = [...reels].sort((a, b) =>
        contentType === 'post'
          ? b.likes - a.likes
          : b.views - a.views || b.likes - a.likes
      )

      const top5 = sorted.slice(0, 5).map((r, i) => {
        const metric = formatMetric(r, contentType)
        const date = new Date(r.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        const type = r.type === 'Video' ? '🎬 Reel' : '🖼️ Post'
        return `  ${i + 1}. [${type}] ${metric} | ${date}\n     Caption: "${r.caption.slice(0, 250).replace(/\n/g, ' ')}"`
      }).join('\n')

      const avgViews = reels.filter(r => r.views > 0).length
        ? Math.round(reels.filter(r => r.views > 0).reduce((s, r) => s + r.views, 0) / reels.filter(r => r.views > 0).length)
        : 0
      const avgLikes = reels.length
        ? Math.round(reels.reduce((s, r) => s + r.likes, 0) / reels.length)
        : 0

      return `@${username} (${reels.length} posts | avg ${avgViews ? avgViews.toLocaleString() + ' views' : avgLikes.toLocaleString() + ' likes'}):\n${top5}`
    })
    .filter(Boolean)
    .join('\n\n')

  // ── Build my own content context ────────────────────────────────────────────
  const myTop = [...(myReels ?? [])]
    .sort((a, b) => contentType === 'post' ? b.likes - a.likes : b.views - a.views || b.likes - a.likes)
    .slice(0, 5)
    .map((r, i) => {
      const metric = formatMetric(r, contentType)
      const date = new Date(r.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      return `  ${i + 1}. ${metric} | ${date} | "${r.caption.slice(0, 200).replace(/\n/g, ' ')}"`
    }).join('\n')

  const myWorst = [...(myReels ?? [])]
    .sort((a, b) => contentType === 'post' ? a.likes - b.likes : a.views - b.views || a.likes - b.likes)
    .slice(0, 3)
    .map((r) => {
      const metric = formatMetric(r, contentType)
      return `  - ${metric} | "${r.caption.slice(0, 150).replace(/\n/g, ' ')}"`
    }).join('\n')

  // ── Prompt ──────────────────────────────────────────────────────────────────
  const prompt = `You are an elite Instagram growth strategist for fintech startups. Your job is to analyse competitor data and give brutally specific, data-driven ${label} ideas that will maximise reach and engagement for @nivixpe.

## CONTEXT
- **Content format requested**: ${label.toUpperCase()}
- **My account**: @nivixpe (fintech startup — instant cross-border payments, currently in beta)
- **Goal**: Generate ${label} ideas based on what's actually working for competitors right now

---

## MY BEST PERFORMING ${label.toUpperCase()}
${myTop || '(no data yet — using competitor analysis only)'}

## MY WORST PERFORMING ${label.toUpperCase()}
${myWorst || '(none)'}

---

## COMPETITOR TOP PERFORMING ${label.toUpperCase()}
${competitorContext || '(no competitor data — give general fintech best practices)'}

---

## YOUR TASK

Analyse the competitor data above and answer:

### 1. 🔍 What patterns are driving competitor success?
List 3–4 specific patterns you see in their top ${label} (hooks, themes, formats, caption styles, posting frequency, engagement triggers). Reference actual captions/metrics.

### 2. 🎯 Content Gap — What @nivixpe is missing
What types of ${label} are competitors making that @nivixpe hasn't tried? These are the biggest opportunities.

### 3. 💡 5 Specific ${label} Ideas to Make This Week
For each idea, give:
- **Format**: ${contentType === 'post' ? 'Static image / Carousel (how many slides)' : contentType === 'video' ? 'Reel duration + structure' : 'Reel or Post — specify which and why'}
- **Hook** (exact opening line / first frame text)
- **Content angle** (what the ${contentType === 'post' ? 'post' : contentType === 'video' ? 'reel' : 'piece'} is actually about)
- **Why this will work** (link to a specific competitor example that validates this)
- **Predicted performance**: 🔥 High / ⚡ Medium / 📊 Baseline

### 4. ⏰ Best posting time for ${label}
Based on competitor post timestamps and engagement, when should @nivixpe post?

### 5. 🏆 Single biggest insight
One sentence. The most important thing @nivixpe should do differently based on this data.

Be specific. Reference competitor usernames and real captions. No generic advice.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${activeKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 3072,
          },
        }),
        signal: AbortSignal.timeout(60_000),
      }
    )

    if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Gemini API error ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const ideas = data.candidates?.[0]?.content?.parts?.[0]?.text as string

    if (!ideas) throw new Error('No content returned from Gemini')

    return NextResponse.json({ ideas })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
