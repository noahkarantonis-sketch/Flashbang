import { supabase } from './supabase'

// Client-side AI calls. These hit YOUR Supabase Edge Function (which holds the
// key and calls Haiku). No Anthropic key ever lives in this app.
async function invoke<T>(op: string, payload: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai', {
    body: { op, payload }
  })
  if (error) {
    // Pull the structured error token the function returned (e.g. LIMIT_REACHED,
    // NOT_SIGNED_IN) so the UI can show the right message instead of a generic one.
    let token = ''
    try {
      const ctx = await (error as any).context?.json?.()
      if (ctx?.error) token = String(ctx.error)
    } catch {
      /* body wasn't readable JSON — fall back below */
    }
    throw new Error(token || 'AI_FAILED')
  }
  if (data?.error) throw new Error(data.error)
  return data.result as T
}

export interface GeneratedCard {
  question: string
  answer: string
  topic: string
  type: 'definition' | 'cause-effect' | 'formula' | 'application' | 'concept'
  format?: 'flip' | 'typed'
}

export interface AnswerGrade {
  verdict: 'correct' | 'partial' | 'incorrect'
  feedback: string
}

export const ai = {
  cardsFromText: (text: string) => invoke<GeneratedCard[]>('cardsFromText', { text }),
  cardsFromImage: (base64: string, mime: string) =>
    invoke<GeneratedCard[]>('cardsFromImage', { base64, mime }),
  cardsFromPdf: (base64: string) => invoke<GeneratedCard[]>('cardsFromPdf', { base64 }),
  hint: (input: { question: string; answer: string; topic: string; history?: string }) =>
    invoke<string>('hint', input),
  explain: (input: { question: string; answer: string; topic: string; context?: string }) =>
    invoke<string>('explain', input),

  // Revise an unsaved generated set per a free-text instruction.
  refineCards: (cards: GeneratedCard[], instruction: string) =>
    invoke<GeneratedCard[]>('refineCards', { cards, instruction }),

  // Generate fresh typed practice questions from concept material.
  practice: (material: string, count = 4) =>
    invoke<GeneratedCard[]>('practice', { material, count }),

  // Grade a typed answer for meaning.
  gradeAnswer: (input: { question: string; answer: string; userAnswer: string; topic: string }) =>
    invoke<AnswerGrade>('gradeAnswer', input)
}

// Friendly messages for the structured errors the server can return.
export function aiErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  switch (msg) {
    case 'NOT_SIGNED_IN':
      return 'Please sign in again.'
    case 'LIMIT_REACHED':
      return "You've used all 5 free card generations for this week. Upgrade to Pro for 250 a week — your hints, explanations, and grading stay unlimited."
    default:
      return 'Something went wrong reaching the AI. Check your connection.'
  }
}
