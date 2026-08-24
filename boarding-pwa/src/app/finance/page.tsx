// src/app/finance/page.tsx
import { createClient } from '@/lib/supabase/server'
import FinanceDashboard from '@/components/finance/FinanceDashboard'

export default async function FinancePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('monthly_budget_limit, budget_currency')
    .eq('id', user?.id)
    .single()

  // NOTE: the schema's `budget_currency` column only tracks home-vs-host *context*,
  // not an ISO currency code. Add home_currency_code / host_currency_code columns
  // to `profiles` and wire them here for real multi-currency support.
  return (
    <FinanceDashboard
      monthlyLimit={profile?.monthly_budget_limit ?? 500}
      budgetCurrency="USD"
      hostCurrencyCode="USD"
      homeCurrencyCode="USD"
    />
  )
}
