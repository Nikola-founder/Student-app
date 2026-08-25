// src/components/journal/JournalView.tsx
'use client'

import { useEffect, useState } from 'react'
import { format, startOfWeek } from 'date-fns'
import { Sparkles, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MOOD_SCALE = [
  { score: 1, emoji: '😞', label: 'Very low' },
  { score: 2, emoji: '😕', label: 'Low' },
  { score: 3, emoji: '😐', label: 'Okay' },
  { score: 4, emoji: '🙂', label: 'Good' },
  { score: 5, emoji: '😄', label: 'Great' },
] as const

const MOOD_TAGS = [
  'Homesick',
  'Excited',
  'Stressed',
  'Anxious',
  'Grateful',
  'Lonely',
  'Motivated',
  'Tired',
]

type WellnessLog = {
  id: string
  log_date: string
  mood_score: number
  mood_tags: string[]
  journal_entry: string | null
  ai_reflection: string | null
}

type WeeklySummary = {
  summary: string
  dominant_moods: string[]
  avg_mood_score: number
}

export default function JournalView() {
  const supabase = createClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [moodScore, setMoodScore] = useState<number | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [entry, setEntry] = useState('')
  const [todayLog, setTodayLog] = useState<WellnessLog | null>(null)
  const [reflection, setReflection] = useState<string | null>(null)
  const [needsSupport, setNeedsSupport] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadToday() {
      const { data } = await supabase
        .from('wellness_logs')
        .select('*')
        .eq('log_date', today)
        .maybeSingle()
      if (data) {
        setTodayLog(data)
        setMoodScore(data.mood_score)
        setTags(data.mood_tags ?? [])
        setEntry(data.journal_entry ?? '')
        setReflection(data.ai_reflection)
      }
    }
    loadToday()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  async function submitJournal() {
    if (!moodScore) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/journal/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logDate: today,
          moodScore,
          moodTags: tags,
          journalEntry: entry,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save entry')
      setReflection(data.reflection)
      setNeedsSupport(data.needsSupportResources)
      setTodayLog(data.log)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function loadWeeklySummary() {
    setLoadingSummary(true)
    setError(null)
    try {
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const res = await fetch('/api/journal/weekly-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No entries yet this week')
      setWeeklySummary(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoadingSummary(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">Wellness Journal</h1>

      {needsSupport && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          It sounds like today's been a lot. If you want to talk to someone, your dorm parent
          or school counselor is a good place to start — you don't have to sit with this alone.
        </div>
      )}

      {/* Mood scale */}
      <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-gray-700">How are you feeling today?</p>
        <div className="flex justify-between">
          {MOOD_SCALE.map((m) => (
            <button
              key={m.score}
              onClick={() => setMoodScore(m.score)}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition ${
                moodScore === m.score ? 'bg-indigo-50 ring-2 ring-indigo-300' : 'hover:bg-gray-50'
              }`}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-[10px] text-gray-500">{m.label}</span>
            </button>
          ))}
        </div>

        <p className="mb-2 mt-4 text-sm font-medium text-gray-700">Tags</p>
        <div className="flex flex-wrap gap-2">
          {MOOD_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                tags.includes(tag)
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <p className="mb-2 mt-4 text-sm font-medium text-gray-700">What&apos;s on your mind?</p>
        <textarea
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          rows={4}
          placeholder="Just a thought dump — write whatever's there..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <button
          onClick={submitJournal}
          disabled={!moodScore || submitting}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Reflecting...
            </>
          ) : todayLog ? (
            'Update today\'s entry'
          ) : (
            'Save entry'
          )}
        </button>
      </div>

      {/* AI reflection */}
      {reflection && (
        <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
            <Sparkles className="h-3.5 w-3.5" /> Today's reflection
          </p>
          <p className="text-sm text-gray-700">{reflection}</p>
        </div>
      )}

      {/* Weekly summary */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">This week's trend</p>
          <button
            onClick={loadWeeklySummary}
            disabled={loadingSummary}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40"
          >
            {loadingSummary ? 'Generating...' : weeklySummary ? 'Refresh' : 'Generate'}
          </button>
        </div>
        {weeklySummary ? (
          <>
            <p className="text-sm text-gray-700">{weeklySummary.summary}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {weeklySummary.dominant_moods.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600"
                >
                  {m}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400">
            Log a few days this week, then generate a trend summary.
          </p>
        )}
      </div>
    </div>
  )
}
