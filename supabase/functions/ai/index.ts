// ===========================================================================
// Flashbang AI proxy — Supabase Edge Function (Deno).
//
// THIS is your "only my API" layer. Your Anthropic key lives here as a server
// secret (never in the app). The model is hardcoded to Haiku, so even a fully
// reverse-engineered client cannot make you pay for a bigger model. Every call
// is gated on: valid logged-in user -> active plan / within usage limit.
//
// Deploy:
//   supabase functions deploy ai
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// ===========================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// HAIKU ONLY. Hardcoded server-side on purpose.
const MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

// Usage limits (calls per calendar month).
// Limits are PER WEEK (resets every ISO week — keeps users coming back).
const LIMITS: Record<string, number> = {
  free: 5, // 5 card-pack generations a week — enough to get hooked
  pro: 250 // generous for any real student (~1000/mo); caps worst-case cost
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const CARD_SYSTEM = `You turn a student's study material into excellent flashcards.

Rules — follow exactly:
- ATOMIC: one fact per card. Never bundle two ideas. Split compound facts into separate cards.
- GROUNDED: only use what is in the supplied material. Never invent facts or pull from outside knowledge. If the material is a messy handwritten page, read it carefully (it may be rushed/abbreviated) and extract the real meaning.
- SPECIFIC TYPES: tag every card as one of definition | cause-effect | formula | application | concept.
- QUESTIONS TEST RECALL, not recognition. Avoid yes/no. Prefer "Why...", "What happens when...", "State the formula for...", "How does X affect Y".
- FORMULAS: put the formula on the answer side, the name/use on the question side.
- TOPIC: give each card a short topic label (2-3 words) inferred from the material, consistent across related cards.
- QUALITY OVER QUANTITY: a clear page yields 6-15 strong cards. Do not pad with trivial or duplicate cards.
- FORMAT: choose how the student should answer each card.
  - "typed" for cards whose answer is a short written response worth actively recalling — definitions, explanations, "why/how" questions, applications. The student types their answer and it gets graded.
  - "flip" for quick-recall cards where typing adds little — single formulas, one-word terms, very short facts. The student reveals and self-grades.
  When in doubt, prefer "typed" if the answer is a phrase or sentence, "flip" if it's a symbol/number/single word.

Return ONLY valid JSON, no prose, no markdown fences:
{"cards":[{"question":"...","answer":"...","topic":"...","type":"definition","format":"typed"}]}`

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' }
  })
}

async function callAnthropic(body: Record<string, unknown>, attempt = 0): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ model: MODEL, ...body })
  })
  if (!res.ok) {
    const t = await res.text()
    // Anthropic 429 (rate limit) / 529 (overloaded) / 5xx are transient — back
    // off and retry a couple of times before giving up.
    if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < 2) {
      console.warn(`anthropic ${res.status}, retrying (attempt ${attempt + 1})`)
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)))
      return callAnthropic(body, attempt + 1)
    }
    throw new Error(`anthropic ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  const block = (data.content || []).find((b: any) => b.type === 'text')
  return block?.text ?? ''
}

// ISO week key like "2026-W22" — the usage period bucket (resets weekly).
function weekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (date.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3) // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(
    ((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
  )
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  if (s === -1 || e === -1) throw new Error('no JSON in model output')
  return JSON.parse(raw.slice(s, e + 1))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  // --- who is calling? ---
  const auth = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: auth } }
  })
  const {
    data: { user }
  } = await userClient.auth.getUser()
  if (!user) return json({ error: 'NOT_SIGNED_IN' }, 401)

  // --- parse the request first (so we know which op is being called) ---
  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad body' }, 400)
  }
  const { op, payload } = body

  // Only card-CREATION ops count toward / are gated by the monthly limit.
  // Study aids (hint, explain, gradeAnswer) are unlimited for everyone — we
  // want free users studying freely; the expensive part is bulk generation.
  const COUNTED = new Set(['cardsFromText', 'cardsFromImage', 'cardsFromPdf', 'refineCards', 'practice'])
  const counts = COUNTED.has(op)

  // --- plan + usage gate (service role bypasses RLS) ---
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const period = weekKey() // resets weekly

  const { data: profile } = await admin
    .from('profiles')
    .select('plan, usage_count, usage_period')
    .eq('id', user.id)
    .single()

  const plan = profile?.plan ?? 'free'
  let count = profile?.usage_count ?? 0
  if (profile?.usage_period !== period) count = 0 // new month resets

  const limit = LIMITS[plan] ?? LIMITS.free
  if (counts && count >= limit) {
    return json({ error: 'LIMIT_REACHED', plan, limit }, 402)
  }

  try {
    let result: unknown

    if (op === 'cardsFromText') {
      const text = await callAnthropic({
        max_tokens: 4096,
        system: CARD_SYSTEM,
        messages: [{ role: 'user', content: `Make flashcards from this material:\n\n${payload.text}` }]
      })
      result = extractJson(text).cards ?? []
    } else if (op === 'cardsFromImage') {
      const text = await callAnthropic({
        max_tokens: 4096,
        system: CARD_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: payload.mime || 'image/png', data: payload.base64 } },
              { type: 'text', text: 'This is a photo/scan of study notes (possibly handwritten and messy). Read it carefully and make flashcards from it.' }
            ]
          }
        ]
      })
      result = extractJson(text).cards ?? []
    } else if (op === 'cardsFromPdf') {
      const text = await callAnthropic({
        max_tokens: 8192,
        system: CARD_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: payload.base64 } },
              { type: 'text', text: 'These are study notes/slides. Read all pages and make flashcards from them.' }
            ]
          }
        ]
      })
      result = extractJson(text).cards ?? []
    } else if (op === 'hint') {
      result = await callAnthropic({
        max_tokens: 300,
        system: `You are a patient tutor giving a HINT, never the answer. 1-3 sentences. Nudge the student's thinking toward the answer. If error history is provided, tailor the hint to the specific misconception it implies. Do not state the answer.`,
        messages: [
          {
            role: 'user',
            content: `Topic: ${payload.topic}\nQuestion: ${payload.question}\nThe answer (do NOT reveal): ${payload.answer}\nMy history with this: ${payload.history || 'no prior data'}\n\nGive me a hint.`
          }
        ]
      })
    } else if (op === 'explain') {
      result = await callAnthropic({
        max_tokens: 600,
        system: `You are an excellent tutor. Explain the concept clearly and concisely for a high-school/early-college student. Connect it to the related material if provided. No filler, no preamble.`,
        messages: [
          {
            role: 'user',
            content: `Topic: ${payload.topic}\nCard: ${payload.question}\nAnswer: ${payload.answer}\nRelated material I have: ${payload.context || 'none'}\n\nExplain this so I actually understand it.`
          }
        ]
      })
    } else if (op === 'refineCards') {
      // Revise an already-generated set of cards per the user's instruction,
      // BEFORE they're saved. Keeps the same JSON shape.
      const text = await callAnthropic({
        max_tokens: 8192,
        system: `${CARD_SYSTEM}

You are now REVISING an existing set of cards based on the user's instruction.
Apply the instruction to the whole set. You may edit, split, merge, add, remove,
or re-format cards as the instruction implies. Keep every rule above. Preserve
good existing cards the instruction doesn't touch. Return the FULL updated set.`,
        messages: [
          {
            role: 'user',
            content: `Current cards (JSON):\n${JSON.stringify(payload.cards)}\n\nInstruction: ${payload.instruction}\n\nReturn the full revised set as JSON.`
          }
        ]
      })
      result = extractJson(text).cards ?? []
    } else if (op === 'practice') {
      // Generate fresh practice questions on the same concept(s). Always typed.
      const text = await callAnthropic({
        max_tokens: 4096,
        system: `You write fresh PRACTICE questions to test understanding of a concept from a new angle.

Rules:
- Base questions ONLY on the concept(s) in the supplied material — same scope, do not drift to new topics.
- Make them DIFFERENT from the originals: rephrase, apply to a new scenario, ask "why/how", flip the direction. Never copy a question verbatim.
- Each needs a correct model answer the grader can check against.
- Keep the same topic label as the source material.
- Every practice question is format "typed".
- Generate exactly ${Math.min(Math.max(Number(payload.count) || 4, 1), 10)} questions.
- Tag type as application | concept | cause-effect | definition | formula.

Return ONLY valid JSON, no prose, no fences:
{"cards":[{"question":"...","answer":"...","topic":"...","type":"application","format":"typed"}]}`,
        messages: [
          { role: 'user', content: `Concept material to practise:\n\n${payload.material}` }
        ]
      })
      result = extractJson(text).cards ?? []
    } else if (op === 'gradeAnswer') {
      // Grade a typed answer for MEANING, not exact wording.
      const text = await callAnthropic({
        max_tokens: 400,
        system: `You grade a student's typed answer against the model answer, judging MEANING not exact wording. Be fair but honest: minor wording/spelling differences are fine; missing or wrong key ideas are not.

Return ONLY valid JSON, no prose, no fences:
{"verdict":"correct|partial|incorrect","feedback":"one or two sentences: what was right, what was missing. Encouraging, specific, never reveal more than needed."}`,
        messages: [
          {
            role: 'user',
            content: `Topic: ${payload.topic}\nQuestion: ${payload.question}\nModel answer: ${payload.answer}\nStudent's answer: ${payload.userAnswer}\n\nGrade it.`
          }
        ]
      })
      result = extractJson(text)
    } else {
      return json({ error: 'unknown op' }, 400)
    }

    // --- record usage (only for counted, card-creation ops) ---
    if (counts) {
      await admin.from('profiles').upsert({
        id: user.id,
        plan,
        usage_count: count + 1,
        usage_period: period
      })
    }

    return json({ result, usage: { count: counts ? count + 1 : count, limit, plan } })
  } catch (e) {
    // Log the real cause so it shows in the function logs (the catch used to
    // swallow it, which is why failures looked invisible in the dashboard).
    console.error(`AI_FAILED op=${op} user=${user.id}: ${String(e)}`)
    return json({ error: 'AI_FAILED', detail: String(e) }, 500)
  }
})
