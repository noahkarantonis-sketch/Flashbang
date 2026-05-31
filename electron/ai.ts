import Anthropic from '@anthropic-ai/sdk'

// ---------------------------------------------------------------------------
// AI layer. Lives in the Electron MAIN process only — the renderer (the UI the
// user can open in DevTools) never sees the API key. The renderer asks for work
// over IPC; this module does it.
//
// When this ships as a paid product, swap the `client` below for a fetch() to
// your own backend proxy — the rest of this file stays identical. That's the
// one-file change that moves the key off the user's machine entirely.
// ---------------------------------------------------------------------------

// HAIKU-ONLY. Every call in this app uses Haiku to keep cost predictable on a
// low student sub. If you ever want a smarter model for the rare "explain"
// path, change MODEL_DEEP — but right now it's deliberately the same as bulk.
const MODEL_BULK = 'claude-haiku-4-5-20251001'
const MODEL_DEEP = 'claude-haiku-4-5-20251001'

let client: Anthropic | null = null

export function setApiKey(key: string) {
  client = key ? new Anthropic({ apiKey: key }) : null
}

export function hasKey() {
  return client !== null
}

function requireClient(): Anthropic {
  if (!client) {
    throw new Error('NO_API_KEY')
  }
  return client
}

export interface GeneratedCard {
  question: string
  answer: string
  topic: string
  type: 'definition' | 'cause-effect' | 'formula' | 'application' | 'concept'
}

// The whole product lives or dies on this prompt. It forces atomic cards,
// specific types, and pulls from the actual content — not generic knowledge.
const CARD_SYSTEM = `You turn a student's study material into excellent flashcards.

Rules — follow exactly:
- ATOMIC: one fact per card. Never bundle two ideas. Split compound facts into separate cards.
- GROUNDED: only use what is in the supplied material. Never invent facts or pull from outside knowledge. If the material is a messy handwritten page, read it carefully (it may be rushed/abbreviated) and extract the real meaning.
- SPECIFIC TYPES: tag every card as one of definition | cause-effect | formula | application | concept.
- QUESTIONS TEST RECALL, not recognition. Avoid yes/no. Prefer "Why...", "What happens when...", "State the formula for...", "How does X affect Y".
- FORMULAS: put the formula on the answer side, the name/use on the question side.
- TOPIC: give each card a short topic label (2-3 words) inferred from the material, consistent across related cards.
- QUALITY OVER QUANTITY: a clear page yields 6-15 strong cards. Do not pad with trivial or duplicate cards.

Return ONLY valid JSON, no prose, no markdown fences:
{"cards":[{"question":"...","answer":"...","topic":"...","type":"definition"}]}`

function extractJson(text: string): any {
  // Models occasionally wrap JSON in fences despite instructions — be forgiving.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('AI returned no JSON')
  return JSON.parse(raw.slice(start, end + 1))
}

export async function generateCardsFromText(text: string): Promise<GeneratedCard[]> {
  const c = requireClient()
  const msg = await c.messages.create({
    model: MODEL_BULK,
    max_tokens: 4096,
    system: CARD_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Make flashcards from this material:\n\n${text}`
      }
    ]
  })
  const out = msg.content.find((b) => b.type === 'text')
  const parsed = extractJson(out && 'text' in out ? out.text : '')
  return parsed.cards ?? []
}

export async function generateCardsFromImage(
  base64: string,
  mimeType: string
): Promise<GeneratedCard[]> {
  const c = requireClient()
  const media = (mimeType || 'image/png') as
    | 'image/png'
    | 'image/jpeg'
    | 'image/webp'
    | 'image/gif'
  const msg = await c.messages.create({
    model: MODEL_BULK,
    max_tokens: 4096,
    system: CARD_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: media, data: base64 }
          },
          {
            type: 'text',
            text: 'This is a photo/scan of study notes (possibly handwritten and messy). Read it carefully and make flashcards from it.'
          }
        ]
      }
    ]
  })
  const out = msg.content.find((b) => b.type === 'text')
  const parsed = extractJson(out && 'text' in out ? out.text : '')
  return parsed.cards ?? []
}

export async function generateCardsFromPdf(base64: string): Promise<GeneratedCard[]> {
  const c = requireClient()
  const msg = await c.messages.create({
    model: MODEL_BULK,
    max_tokens: 8192,
    system: CARD_SYSTEM,
    messages: [
      {
        role: 'user',
        // `document` blocks (PDF) are supported by the API; cast past the
        // stricter SDK content-block union.
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 }
          },
          {
            type: 'text',
            text: 'These are study notes/slides. Read all pages and make flashcards from them.'
          }
        ] as any
      }
    ]
  })
  const out = msg.content.find((b) => b.type === 'text')
  const parsed = extractJson(out && 'text' in out ? out.text : '')
  return parsed.cards ?? []
}

// Adaptive hint — scaled to WHY the student is stuck, never reveals the answer.
export async function getHint(input: {
  question: string
  answer: string
  topic: string
  history?: string // e.g. "missed on Test 2 (2/5)", or recent grades
}): Promise<string> {
  const c = requireClient()
  const msg = await c.messages.create({
    model: MODEL_BULK,
    max_tokens: 300,
    system: `You are a patient tutor giving a HINT, never the answer. 1-3 sentences. Nudge the student's thinking toward the answer. If error history is provided, tailor the hint to the specific misconception it implies. Do not state the answer.`,
    messages: [
      {
        role: 'user',
        content: `Topic: ${input.topic}\nQuestion: ${input.question}\nThe answer (do NOT reveal): ${input.answer}\nMy history with this: ${input.history || 'no prior data'}\n\nGive me a hint.`
      }
    ]
  })
  const out = msg.content.find((b) => b.type === 'text')
  return out && 'text' in out ? out.text.trim() : ''
}

// Deeper explanation, in context of the student's other material. Uses the
// better model because this is the "I genuinely don't get it" path.
export async function explain(input: {
  question: string
  answer: string
  topic: string
  context?: string // related notes/cards from the graph
}): Promise<string> {
  const c = requireClient()
  const msg = await c.messages.create({
    model: MODEL_DEEP,
    max_tokens: 600,
    system: `You are an excellent tutor. Explain the concept clearly and concisely for a high-school/early-college student. Connect it to the related material if provided. No filler, no preamble.`,
    messages: [
      {
        role: 'user',
        content: `Topic: ${input.topic}\nCard: ${input.question}\nAnswer: ${input.answer}\nRelated material I have: ${input.context || 'none'}\n\nExplain this so I actually understand it.`
      }
    ]
  })
  const out = msg.content.find((b) => b.type === 'text')
  return out && 'text' in out ? out.text.trim() : ''
}
