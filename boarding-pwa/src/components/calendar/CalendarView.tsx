// src/components/calendar/CalendarView.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Trash2, Globe2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { dualTimeLabel } from '@/lib/timezone'

type Category = 'academics' | 'social' | 'personal' | 'dorm' | 'travel'
type ViewMode = 'day' | 'week' | 'month' | 'agenda'

const CATEGORY_COLORS: Record<Category, string> = {
  academics: '#4F46E5', // indigo
  social: '#EC4899', // pink
  personal: '#10B981', // emerald
  dorm: '#F59E0B', // amber
  travel: '#0EA5E9', // sky
}

type CalendarEvent = {
  id: string
  title: string
  description: string | null
  start_time: string // ISO / UTC
  end_time: string
  category: Category
  color: string
  is_reminder: boolean
  is_all_day: boolean
  location: string | null
}

type Profile = {
  home_timezone: string
  host_timezone: string
}

export default function CalendarView({
  homeTimezone = 'America/New_York',
  hostTimezone = 'Europe/London',
}: {
  homeTimezone?: string
  hostTimezone?: string
}) {
  const supabase = createClient()

  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState(new Date()) // anchor date for the current view
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showDualTz, setShowDualTz] = useState(true)
  const [modalEvent, setModalEvent] = useState<Partial<CalendarEvent> | null>(null)

  const profile: Profile = { home_timezone: homeTimezone, host_timezone: hostTimezone }

  // ---- Range for current view (drives the DB query) ----
  const range = useMemo(() => {
    if (view === 'day') return { start: cursor, end: addDays(cursor, 1) }
    if (view === 'week')
      return { start: startOfWeek(cursor), end: endOfWeek(cursor) }
    if (view === 'agenda')
      return { start: cursor, end: addDays(cursor, 30) } // rolling 30-day agenda
    // month view — pad to full weeks for a clean grid
    return {
      start: startOfWeek(startOfMonth(cursor)),
      end: endOfWeek(endOfMonth(cursor)),
    }
  }, [view, cursor])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('start_time', range.start.toISOString())
        .lte('start_time', range.end.toISOString())
        .order('start_time', { ascending: true })

      if (!error) setEvents(data ?? [])
      setLoading(false)
    }
    load()
  }, [range, supabase])

  async function saveEvent(evt: Partial<CalendarEvent>) {
    const payload = {
      title: evt.title,
      description: evt.description ?? null,
      start_time: evt.start_time,
      end_time: evt.end_time,
      category: evt.category ?? 'personal',
      color: CATEGORY_COLORS[(evt.category ?? 'personal') as Category],
      is_reminder: evt.is_reminder ?? false,
      is_all_day: evt.is_all_day ?? false,
      location: evt.location ?? null,
    }

    if (evt.id) {
      await supabase.from('events').update(payload).eq('id', evt.id)
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await supabase.from('events').insert({ ...payload, user_id: user?.id })
    }

    setModalEvent(null)
    // refresh
    const { data } = await supabase
      .from('events')
      .select('*')
      .gte('start_time', range.start.toISOString())
      .lte('start_time', range.end.toISOString())
      .order('start_time', { ascending: true })
    setEvents(data ?? [])
  }

  async function deleteEvent(id: string) {
    await supabase.from('events').delete().eq('id', id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setModalEvent(null)
  }

  function stepView(direction: 1 | -1) {
    if (view === 'day') setCursor((c) => addDays(c, direction))
    else if (view === 'week') setCursor((c) => addWeeks(c, direction))
    else if (view === 'agenda') setCursor((c) => addDays(c, direction * 30))
    else setCursor((c) => addMonths(c, direction))
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => stepView(-1)}
            className="rounded-full p-1.5 hover:bg-gray-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="min-w-[160px] text-lg font-semibold text-gray-900">
            {view === 'month' && format(cursor, 'MMMM yyyy')}
            {view === 'week' &&
              `${format(startOfWeek(cursor), 'MMM d')} – ${format(endOfWeek(cursor), 'MMM d, yyyy')}`}
            {view === 'day' && format(cursor, 'EEEE, MMM d, yyyy')}
            {view === 'agenda' && 'Next 30 days'}
          </h2>
          <button
            onClick={() => stepView(1)}
            className="rounded-full p-1.5 hover:bg-gray-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDualTz((s) => !s)}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${
              showDualTz ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'
            }`}
            title="Toggle dual timezone display"
          >
            <Globe2 className="h-3.5 w-3.5" /> Dual TZ
          </button>
          <ViewTabs view={view} setView={setView} />
          <button
            onClick={() =>
              setModalEvent({
                start_time: new Date().toISOString(),
                end_time: new Date().toISOString(),
                category: 'personal',
              })
            }
            className="flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>
      </div>

      {/* Category legend */}
      <div className="mb-4 flex flex-wrap gap-3">
        {(Object.keys(CATEGORY_COLORS) as Category[]).map((cat) => (
          <span key={cat} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[cat] }}
            />
            {cat}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      ) : (
        <>
          {view === 'month' && (
            <MonthGrid
              cursor={cursor}
              events={events}
              range={range}
              onSelectEvent={setModalEvent}
            />
          )}
          {view === 'week' && (
            <WeekList
              range={range}
              events={events}
              profile={profile}
              showDualTz={showDualTz}
              onSelectEvent={setModalEvent}
            />
          )}
          {view === 'day' && (
            <DayList
              day={cursor}
              events={events.filter((e) => isSameDay(new Date(e.start_time), cursor))}
              profile={profile}
              showDualTz={showDualTz}
              onSelectEvent={setModalEvent}
            />
          )}
          {view === 'agenda' && (
            <AgendaList
              events={events}
              profile={profile}
              showDualTz={showDualTz}
              onSelectEvent={setModalEvent}
            />
          )}
        </>
      )}

      {modalEvent && (
        <EventModal
          event={modalEvent}
          onClose={() => setModalEvent(null)}
          onSave={saveEvent}
          onDelete={modalEvent.id ? () => deleteEvent(modalEvent.id!) : undefined}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// View tabs
// ---------------------------------------------------------------------------
function ViewTabs({
  view,
  setView,
}: {
  view: ViewMode
  setView: (v: ViewMode) => void
}) {
  const options: ViewMode[] = ['day', 'week', 'month', 'agenda']
  return (
    <div className="flex rounded-full bg-gray-100 p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => setView(o)}
          className={`rounded-full px-3 py-1 font-medium capitalize transition ${
            view === o ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Month grid
// ---------------------------------------------------------------------------
function MonthGrid({
  cursor,
  events,
  range,
  onSelectEvent,
}: {
  cursor: Date
  events: CalendarEvent[]
  range: { start: Date; end: Date }
  onSelectEvent: (e: Partial<CalendarEvent>) => void
}) {
  const days = eachDayOfInterval({ start: range.start, end: range.end })

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-gray-100 bg-gray-100">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
        <div key={d} className="bg-white p-2 text-center text-xs font-medium text-gray-400">
          {d}
        </div>
      ))}
      {days.map((day) => {
        const dayEvents = events.filter((e) => isSameDay(new Date(e.start_time), day))
        return (
          <div
            key={day.toISOString()}
            className={`min-h-[90px] bg-white p-1.5 ${
              !isSameMonth(day, cursor) ? 'opacity-40' : ''
            }`}
          >
            <span
              className={`text-xs ${
                isSameDay(day, new Date()) ? 'font-bold text-indigo-600' : 'text-gray-500'
              }`}
            >
              {format(day, 'd')}
            </span>
            <div className="mt-1 space-y-1">
              {dayEvents.slice(0, 3).map((e) => (
                <button
                  key={e.id}
                  onClick={() => onSelectEvent(e)}
                  className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-white"
                  style={{ backgroundColor: e.color }}
                >
                  {e.title}
                </button>
              ))}
              {dayEvents.length > 3 && (
                <span className="block text-[10px] text-gray-400">
                  +{dayEvents.length - 3} more
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Week list (grouped by day)
// ---------------------------------------------------------------------------
function WeekList({
  range,
  events,
  profile,
  showDualTz,
  onSelectEvent,
}: {
  range: { start: Date; end: Date }
  events: CalendarEvent[]
  profile: Profile
  showDualTz: boolean
  onSelectEvent: (e: Partial<CalendarEvent>) => void
}) {
  const days = eachDayOfInterval({ start: range.start, end: range.end })
  return (
    <div className="space-y-4">
      {days.map((day) => {
        const dayEvents = events.filter((e) => isSameDay(new Date(e.start_time), day))
        if (dayEvents.length === 0) return null
        return (
          <div key={day.toISOString()}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {format(day, 'EEEE, MMM d')}
            </p>
            <div className="space-y-1.5">
              {dayEvents.map((e) => (
                <EventRow
                  key={e.id}
                  event={e}
                  profile={profile}
                  showDualTz={showDualTz}
                  onClick={() => onSelectEvent(e)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Day list
// ---------------------------------------------------------------------------
function DayList({
  events,
  profile,
  showDualTz,
  onSelectEvent,
}: {
  day: Date
  events: CalendarEvent[]
  profile: Profile
  showDualTz: boolean
  onSelectEvent: (e: Partial<CalendarEvent>) => void
}) {
  if (events.length === 0)
    return <p className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">Nothing scheduled today.</p>
  return (
    <div className="space-y-1.5">
      {events.map((e) => (
        <EventRow key={e.id} event={e} profile={profile} showDualTz={showDualTz} onClick={() => onSelectEvent(e)} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Agenda list (flat, chronological)
// ---------------------------------------------------------------------------
function AgendaList({
  events,
  profile,
  showDualTz,
  onSelectEvent,
}: {
  events: CalendarEvent[]
  profile: Profile
  showDualTz: boolean
  onSelectEvent: (e: Partial<CalendarEvent>) => void
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = format(new Date(e.start_time), 'EEEE, MMM d')
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return Array.from(map.entries())
  }, [events])

  if (events.length === 0)
    return <p className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">No upcoming events.</p>

  return (
    <div className="space-y-4">
      {grouped.map(([label, dayEvents]) => (
        <div key={label}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <div className="space-y-1.5">
            {dayEvents.map((e) => (
              <EventRow key={e.id} event={e} profile={profile} showDualTz={showDualTz} onClick={() => onSelectEvent(e)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared event row
// ---------------------------------------------------------------------------
function EventRow({
  event,
  profile,
  showDualTz,
  onClick,
}: {
  event: CalendarEvent
  profile: Profile
  showDualTz: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm hover:shadow-md"
    >
      <span className="h-full w-1 flex-shrink-0 self-stretch rounded-full" style={{ backgroundColor: event.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{event.title}</p>
        <p className="text-xs text-gray-500">
          {showDualTz
            ? dualTimeLabel(event.start_time, profile.home_timezone, profile.host_timezone)
            : format(new Date(event.start_time), 'h:mm a')}
          {event.location ? ` · ${event.location}` : ''}
        </p>
      </div>
      {event.is_reminder && (
        <span className="flex-shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
          Reminder
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Create/Edit modal
// ---------------------------------------------------------------------------
function EventModal({
  event,
  onClose,
  onSave,
  onDelete,
}: {
  event: Partial<CalendarEvent>
  onClose: () => void
  onSave: (e: Partial<CalendarEvent>) => void
  onDelete?: () => void
}) {
  const [form, setForm] = useState<Partial<CalendarEvent>>(event)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {form.id ? 'Edit event' : 'New event'}
          </h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            placeholder="Title"
            value={form.title ?? ''}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={form.start_time ? form.start_time.slice(0, 16) : ''}
              onChange={(e) =>
                setForm({ ...form, start_time: new Date(e.target.value).toISOString() })
              }
              className="rounded-lg border border-gray-200 px-2 py-2 text-xs outline-none focus:border-indigo-400"
            />
            <input
              type="datetime-local"
              value={form.end_time ? form.end_time.slice(0, 16) : ''}
              onChange={(e) =>
                setForm({ ...form, end_time: new Date(e.target.value).toISOString() })
              }
              className="rounded-lg border border-gray-200 px-2 py-2 text-xs outline-none focus:border-indigo-400"
            />
          </div>
          <select
            value={form.category ?? 'personal'}
            onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            {(Object.keys(CATEGORY_COLORS) as Category[]).map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          <input
            placeholder="Location (optional)"
            value={form.location ?? ''}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={form.is_reminder ?? false}
              onChange={(e) => setForm({ ...form, is_reminder: e.target.checked })}
            />
            Treat as reminder
          </label>
        </div>

        <div className="mt-5 flex items-center justify-between">
          {onDelete ? (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={() => onSave(form)}
            disabled={!form.title || !form.start_time || !form.end_time}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
