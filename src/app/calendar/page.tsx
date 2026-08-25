// src/app/calendar/page.tsx
import { createClient } from '@/lib/supabase/server'
import CalendarView from '@/components/calendar/CalendarView'

export default async function CalendarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('home_timezone, host_timezone')
    .eq('id', user?.id)
    .single()

  return (
    <CalendarView
      homeTimezone={profile?.home_timezone ?? 'America/New_York'}
      hostTimezone={profile?.host_timezone ?? 'Europe/London'}
    />
  )
}
