// src/app/api/journal/reflect/route.ts
//
// POST /api/journal/reflect
// Body: { logDate: "2026-08-24", moodScore: 3, moodTags: ["Homesick","Tired"], journalEntry: "..." }
//
// Reads the student's daily journal entry, asks Groq to produce a short,
// supportive, *grounded* reflection (no diagnosing, no therapy-speak),
// saves it to wellness_logs, and returns it as JSON.

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@/lib/supabase/server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Groq's fast Llama model — good latency/quality tradeoff for a short reflection.
// Check console.groq.com/docs/models for the current list before deploying.
const MODEL = 'llama-3.3-70b-versatile'

const SYSTEM_PROMPT = `You are a warm, grounded wellness companion inside a journaling app for international boarding students living away from home.

Rules:
- Read the student's mood score (1-5), mood tags, and free-text entry.
- Write EXACTLY 2-3 sentences of reflection. No more.
- Be validating and specific to what they actually wrote — never generic ("that sounds hard") without substance.
- Never diagnose, never suggest medication, never use clinical/therapy jargon.
- If the entry suggests real crisis, self-harm, or danger, do NOT try to handle it yourself —
  instead set "needs_support_resources" to true in your JSON output and keep the reflection gentle and non-alarming.
- Tone: like a thoughtful older student or trusted staff member, not a chatbot.
- Output ONLY valid JSON matching this exact schema, nothing else, no markdown fences:

{
  "reflection": "string, 2-3 sentences",
  "detected_tone": "string, 1-3 words e.g. 'homesick but hopeful'",
  "needs_support_resources": boolean
}`

export async function POST(req: NextRequest) {
  try {
    const { logDate, moodScore, moodTags, journalEntry } = await req.json()

    if (!logDate || !moodScore) {
      return NextResponse.json(
        { error: 'logDate and moodScore are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Build the user-facing prompt from structured inputs
    const userPrompt = `Mood score (1=very low, 5=great): ${moodScore}
Mood tags: ${Array.isArray(moodTags) && moodTags.length ? moodTags.join(', ') : 'none given'}
Journal entry: ${journalEntry?.trim() ? journalEntry.trim() : '(no free text entry today)'}`

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      max_tokens: 300,
      response_format: { type: 'json_object' }, // Groq supports JSON mode for structured output
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let parsed: {
      reflection: string
      detected_tone?: string
      needs_support_resources?: boolean
    }

    try {
      parsed = JSON.parse(raw)
    } catch {
      // Model occasionally wraps JSON in prose despite instructions — fail safe.
      return NextResponse.json(
        { error: 'AI response was not valid JSON', raw },
        { status: 502 }
      )
    }

    // Persist to wellness_logs (upsert — one row per user per day)
    const { data: saved, error: dbError } = await supabase
      .from('wellness_logs')
      .upsert(
        {
          user_id: user.id,
          log_date: logDate,
          mood_score: moodScore,
          mood_tags: moodTags ?? [],
          journal_entry: journalEntry ?? null,
          ai_reflection: parsed.reflection,
          ai_reflection_model: MODEL,
          ai_reflection_generated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,log_date' }
      )
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({
      reflection: parsed.reflection,
      detectedTone: parsed.detected_tone ?? null,
      needsSupportResources: parsed.needs_support_resources ?? false,
      log: saved,
    })
  } catch (err) {
    console.error('journal/reflect error:', err)
    return NextResponse.json(
      { error: 'Something went wrong generating the reflection.' },
      { status: 500 }
    )
  }
}
