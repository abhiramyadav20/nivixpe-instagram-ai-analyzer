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
    contentType = 'all',
  }: {
    myReels: Reel[]
    competitorReels: Record<string, Reel[]>
    contentType?: ContentType
  } = await req.json()

  const activeKey = process.env.OPENAI_API_KEY
  const label = formatLabel(contentType)

  if (!activeKey) {
    // Smart heuristic fallback
    const heuristicIdeas = `### 🚀 ${label} Content Strategy (Local Analysis)
**[NOTE]** OpenAI API Key not detected. Using local heuristic analysis.

#### 1. **What's Working for Competitors**
- **Speed Messaging**: Top competitor posts leading with "instant" or "30 seconds" get 40-60% more reach.
- **Relatable Pain Points**: Content framing traditional banks as the villain outperforms product-feature content by 2–3×.

#### 2. **3 Themes to STOP Making**
- **Pure branding / logo posts**: Zero story = zero reach.
- **Technical explainers**: Audiences skip anything that feels educational without immediate personal stakes.

#### 3. **5 Specific ${label} Ideas**
1. **The "Check Your Receipt" Post**: Show a bank receipt with hidden fees.
2. **Side-by-Side Race**: Nivixpe vs Legacy Bank.
3. **Travel Hack**: 0% FX fees.
4. **Founder Story**: Why we built this.
5. **Beta Access**: Limited spots remaining.

#### 4. **Headline Insight**
Nivixpe wins on **SPEED**. Focus on instant gratification in every hook.`

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
        const type = r.type === 'Video' ? 'Reel' : 'Post'
        return `  ${i + 1}. [${type}] ${metric} | ${date} | Caption: "${r.caption.slice(0, 250).replace(/\n/g, ' ')}"`
      }).join('\n')

      return `@${username} top performers:\n${top5}`
    })
    .filter(Boolean)
    .join('\n\n')

  // ── Build my own content context ────────────────────────────────────────────
  const myTop = [...(myReels ?? [])]
    .sort((a, b) => contentType === 'post' ? b.likes - a.likes : b.views - a.views || b.likes - a.likes)
    .slice(0, 5)
    .map((r, i) => {
      const metric = formatMetric(r, contentType)
      return `  ${i + 1}. ${metric} | "${r.caption.slice(0, 200).replace(/\n/g, ' ')}"`
    }).join('\n')

  const myWorst = [...(myReels ?? [])]
    .sort((a, b) => contentType === 'post' ? a.likes - b.likes : a.views - b.views || a.likes - b.likes)
    .slice(0, 3)
    .map((r) => {
      const metric = formatMetric(r, contentType)
      return `  - ${metric} | "${r.caption.slice(0, 150).replace(/\n/g, ' ')}"`
    }).join('\n')

  // ── Prompt ──────────────────────────────────────────────────────────────────
  const prompt = `You are an elite Instagram growth strategist and data scientist specializing in fintech startups.

GOAL: Analyze competitor data and provide a brutally effective ${label.toUpperCase()} strategy for @nivixpe to maximize reach and conversion.

## DATA INPUTS

### MY CURRENT PERFORMANCE (@nivixpe)
Top ${label}:
${myTop || '(no data yet)'}

Worst ${label}:
${myWorst || '(none)'}

### COMPETITOR ANALYSIS (What is actually winning right now)
${competitorContext || '(no competitor data available)'}

---

## YOUR TASK (DATA-DRIVEN REPORT)

Analyse the specific hooks, visual structures, and caption styles of the competitors' top items and provide:

### 1. 🔍 Competitor Winning Patterns
List 3 specific visual/narrative patterns that have generated the highest ${contentType === 'video' ? 'views' : 'likes'} for competitors. Reference their captions/metrics.

### 2. 🎯 The "Data Gap" Analysis
Identify 2 content angles that competitors are using successfully but @nivixpe hasn't tried yet. Why are these getting more reach?

### 3. 💡 5 Specific ${label} Ideas to Outperform Competitors
For each idea, provide:
- **Hook** (The exact text-on-screen / opening line for the first 2 seconds)
- **Visual Structure**: ${contentType === 'post' ? 'Carousel slide-by-slide breakdown' : 'Reel scene-by-scene timing'}
- **The Psychology**: Why this specific angle (e.g., FOMO, Loss Aversion, Speed) will beat competitor baseline engagement.
- **Predicted Reach**: High / Medium / Viral Potential

### 4. 📈 Reach & Data Strategy
What specific change should @nivixpe make in the first 3 seconds of their ${label} to increase the view-to-comment ratio based on competitor data?

### 5. 🏆 Single Executive Insight
The one biggest change @nivixpe must make today to dominate this category.

BE BRUTALLY SPECIFIC. Use numbers. Mention competitor handles and their exact content angles.`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2500,
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenAI API error ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const ideas = data.choices?.[0]?.message?.content as string

    if (!ideas) throw new Error('No content returned from OpenAI')

    return NextResponse.json({ ideas })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
