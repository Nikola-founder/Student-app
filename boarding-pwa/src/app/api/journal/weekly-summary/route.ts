// src/app/api/journal/weekly-summary/route.ts
//
// POST /api/journal/weekly-summary
// Body: { weekStart: "2026-08-18" }   // Monday of the target week
//
// Pulls the student's wellness_logs for that week, asks Groq to summarize
// the emotional trend, caches the result in weekly_emotion_summaries.

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { addDays, format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = 'llama-3.3-70b-versatile'

const SYSTEM_PROMPT = `You summarize a week of a boarding student's daily mood logs into a short trend summary.

Rules:
- 2-4 sentences total.
- Name the overall trajectory (improving / stable / dipping) and point to what seemed to drive it, using only what's in the logs.
- Do not invent events not mentioned in the entries.
- Supportive, plain language, no clinical terms.
- Output ONLY valid JSON, no markdown fences:

{
  "summary": "string",
  "dominant_moods": ["string", "string"]
}`

export async function POST(req: NextRequest) {
  try {
    const { weekStart } = await req.json()
    if (!weekStart) {
      return NextResponse.json({ error: 'weekStart is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const weekEnd = format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd')

    const { data: logs, error: fetchError } = await supabase
      .from('wellness_logs')
      .select('log_date, mood_score, mood_tags, journal_entry')
      .eq('user_id', user.id)
      .gte('log_date', weekStart)
      .lte('log_date', weekEnd)
      .order('log_date', { ascending: true })

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json(
        { error: 'No journal entries found for that week yet.' },
        { status: 404 }
      )
    }

    const avgMood =
      logs.reduce((sum, l) => sum + l.mood_score, 0) / logs.length

    const logsText = logs
      .map(
        (l) =>
          `${l.log_date}: mood ${l.mood_score}/5, tags: [${(l.mood_tags || []).join(', ')}]${
            l.journal_entry ? `, entry: "${l.journal_entry.slice(0, 200)}"` : ''
          }`
      )
      .join('\n')

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      max_tokens: 350,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Week of ${weekStart} to ${weekEnd}:\n${logsText}` },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let parsed: { summary: string; dominant_moods?: string[] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { error: 'AI response was not valid JSON', raw },
        { status: 502 }
      )
    }

    const { data: saved, error: dbError } = await supabase
      .from('weekly_emotion_summaries')
      .upsert(
        {
          user_id: user.id,
          week_start: weekStart,
          summary: parsed.summary,
          dominant_moods: parsed.dominant_moods ?? [],
          avg_mood_score: Number(avgMood.toFixed(2)),
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_start' }
      )
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json(saved)
  } catch (err) {
    console.error('journal/weekly-summary error:', err)
    return NextResponse.json(
      { error: 'Something went wrong generating the weekly summary.' },
      { status: 500 }
    )
  }
}
