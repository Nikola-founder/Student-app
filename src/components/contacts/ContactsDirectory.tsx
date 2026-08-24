// src/components/contacts/ContactsDirectory.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, MapPin, Phone, MessageCircle, Home, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type BoardingHouse = {
  id: string
  name: string
}

type Contact = {
  id: string
  name: string
  country_of_origin: string | null
  phone: string | null
  social_handle: string | null
  room_number: string | null
  grade_level: string | null
  primary_language: string | null
  notes: string | null
  boarding_house_id: string | null
  boarding_houses?: { name: string } | null
}

export default function ContactsDirectory() {
  const supabase = createClient()

  const [contacts, setContacts] = useState<Contact[]>([])
  const [houses, setHouses] = useState<BoardingHouse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [houseFilter, setHouseFilter] = useState<string>('all')
  const [gradeFilter, setGradeFilter] = useState<string>('all')
  const [languageFilter, setLanguageFilter] = useState<string>('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const [{ data: contactsData, error: contactsError }, { data: housesData }] =
        await Promise.all([
          supabase
            .from('contacts')
            .select('*, boarding_houses ( name )')
            .order('name', { ascending: true }),
          supabase.from('boarding_houses').select('id, name').order('name'),
        ])

      if (contactsError) {
        setError(contactsError.message)
      } else {
        setContacts(contactsData ?? [])
      }
      setHouses(housesData ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  // Distinct grade/language options, derived from actual data
  const gradeOptions = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.grade_level).filter(Boolean))) as string[],
    [contacts]
  )
  const languageOptions = useMemo(
    () =>
      Array.from(new Set(contacts.map((c) => c.primary_language).filter(Boolean))) as string[],
    [contacts]
  )

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter((c) => {
      if (houseFilter !== 'all' && c.boarding_house_id !== houseFilter) return false
      if (gradeFilter !== 'all' && c.grade_level !== gradeFilter) return false
      if (languageFilter !== 'all' && c.primary_language !== languageFilter) return false
      if (
        q &&
        !`${c.name} ${c.country_of_origin ?? ''} ${c.room_number ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      return true
    })
  }, [contacts, search, houseFilter, gradeFilter, languageFilter])

  const activeFilterCount =
    (houseFilter !== 'all' ? 1 : 0) +
    (gradeFilter !== 'all' ? 1 : 0) +
    (languageFilter !== 'all' ? 1 : 0)

  function clearFilters() {
    setHouseFilter('all')
    setGradeFilter('all')
    setLanguageFilter('all')
    setSearch('')
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">Dorm &amp; Social Directory</h1>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, country, or room number..."
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Boarding House"
          value={houseFilter}
          onChange={setHouseFilter}
          options={houses.map((h) => ({ value: h.id, label: h.name }))}
        />
        <FilterSelect
          label="Grade"
          value={gradeFilter}
          onChange={setGradeFilter}
          options={gradeOptions.map((g) => ({ value: g, label: g }))}
        />
        <FilterSelect
          label="Language"
          value={languageFilter}
          onChange={setLanguageFilter}
          options={languageOptions.map((l) => ({ value: l, label: l }))}
        />
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      {/* States */}
      {loading && <SkeletonList />}
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          Couldn&apos;t load contacts: {error}
        </p>
      )}
      {!loading && !error && filteredContacts.length === 0 && (
        <p className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
          No contacts match your filters yet.
        </p>
      )}

      {/* Contact cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filteredContacts.map((c) => (
          <ContactCard key={c.id} contact={c} />
        ))}
      </div>
    </div>
  )
}

function ContactCard({ contact }: { contact: Contact }) {
  const initials = contact.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-medium text-gray-900">{contact.name}</h3>
            {contact.room_number && (
              <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                Rm {contact.room_number}
              </span>
            )}
          </div>
          {contact.country_of_origin && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="h-3 w-3" /> {contact.country_of_origin}
              {contact.primary_language ? ` · ${contact.primary_language}` : ''}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {contact.boarding_houses?.name && (
              <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                <Home className="h-3 w-3" /> {contact.boarding_houses.name}
              </span>
            )}
            {contact.grade_level && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                {contact.grade_level}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-1 text-sm text-gray-600">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 hover:text-indigo-600">
                <Phone className="h-3.5 w-3.5" /> {contact.phone}
              </a>
            )}
            {contact.social_handle && (
              <span className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> {contact.social_handle}
              </span>
            )}
          </div>

          {contact.notes && (
            <p className="mt-2 line-clamp-2 text-xs italic text-gray-400">{contact.notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm outline-none focus:border-indigo-400"
    >
      <option value="all">{label}: All</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function SkeletonList() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
      ))}
    </div>
  )
}
