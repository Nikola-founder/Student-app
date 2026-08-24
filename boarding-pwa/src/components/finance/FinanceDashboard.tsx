// src/components/finance/FinanceDashboard.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Plus, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

type ExpenseCategory = 'food' | 'transit' | 'school_supplies' | 'social' | 'other'
type CurrencyContext = 'home' | 'host'

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  food: '#F59E0B',
  transit: '#0EA5E9',
  school_supplies: '#8B5CF6',
  social: '#EC4899',
  other: '#94A3B8',
}

type Expense = {
  id: string
  description: string
  category: ExpenseCategory
  amount: number
  currency_code: string
  currency_context: CurrencyContext
  amount_in_home_currency: number | null
  expense_date: string
}

export default function FinanceDashboard({
  monthlyLimit = 500,
  budgetCurrency = 'USD',
  hostCurrencyCode = 'USD',
  homeCurrencyCode = 'USD',
}: {
  monthlyLimit?: number
  budgetCurrency?: string
  hostCurrencyCode?: string
  homeCurrencyCode?: string
}) {
  const supabase = createClient()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const monthStart = startOfMonth(new Date())
  const monthEnd = endOfMonth(new Date())

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('expense_date', format(monthEnd, 'yyyy-MM-dd'))
        .order('expense_date', { ascending: false })
      setExpenses(data ?? [])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Everything normalized to "budget currency" for the progress bar —
  // amount_in_home_currency is a pre-converted snapshot taken at entry time.
  const totalSpent = useMemo(
    () =>
      expenses.reduce(
        (sum, e) =>
          sum + (budgetCurrency === homeCurrencyCode ? (e.amount_in_home_currency ?? e.amount) : e.amount),
        0
      ),
    [expenses, budgetCurrency, homeCurrencyCode]
  )

  const pieData = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const e of expenses) {
      totals[e.category] = (totals[e.category] ?? 0) + e.amount
    }
    return Object.entries(totals).map(([category, value]) => ({
      name: category.replace('_', ' '),
      value,
      color: CATEGORY_COLORS[category as ExpenseCategory],
    }))
  }, [expenses])

  const percentUsed = Math.min(100, Math.round((totalSpent / monthlyLimit) * 100))
  const isOverBudget = totalSpent > monthlyLimit

  async function addExpense(expense: Omit<Expense, 'id'>) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await supabase.from('expenses').insert({ ...expense, user_id: user?.id })
    setShowForm(false)
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .gte('expense_date', format(monthStart, 'yyyy-MM-dd'))
      .lte('expense_date', format(monthEnd, 'yyyy-MM-dd'))
      .order('expense_date', { ascending: false })
    setExpenses(data ?? [])
  }

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Finance</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" /> Log expense
        </button>
      </div>

      {/* Monthly budget progress */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">
            {format(new Date(), 'MMMM')} spending
          </span>
          <span className={isOverBudget ? 'font-semibold text-red-500' : 'text-gray-500'}>
            {totalSpent.toFixed(2)} / {monthlyLimit.toFixed(2)} {budgetCurrency}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${
              isOverBudget ? 'bg-red-500' : percentUsed > 80 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
        {isOverBudget && (
          <p className="mt-1.5 text-xs text-red-500">
            {(totalSpent - monthlyLimit).toFixed(2)} {budgetCurrency} over your monthly limit
          </p>
        )}
      </div>

      {/* Pie chart breakdown */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-medium text-gray-700">By category</p>
        {loading ? (
          <div className="h-52 animate-pulse rounded-xl bg-gray-100" />
        ) : pieData.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No expenses logged this month yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => v.toFixed(2)} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent expenses */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-medium text-gray-700">Recent expenses</p>
        {expenses.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">Nothing logged yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[e.category] }}
                  />
                  <div>
                    <p className="text-sm text-gray-900">{e.description}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(e.expense_date), 'MMM d')} · {e.category.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">
                    {e.amount.toFixed(2)} {e.currency_code}
                  </span>
                  <button onClick={() => deleteExpense(e.id)} className="text-gray-300 hover:text-red-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <ExpenseForm
          hostCurrencyCode={hostCurrencyCode}
          homeCurrencyCode={homeCurrencyCode}
          onClose={() => setShowForm(false)}
          onSave={addExpense}
        />
      )}
    </div>
  )
}

function ExpenseForm({
  hostCurrencyCode,
  homeCurrencyCode,
  onClose,
  onSave,
}: {
  hostCurrencyCode: string
  homeCurrencyCode: string
  onClose: () => void
  onSave: (e: Omit<Expense, 'id'>) => void
}) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('food')
  const [amount, setAmount] = useState('')
  const [currencyContext, setCurrencyContext] = useState<CurrencyContext>('host')
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const currencyCode = currencyContext === 'host' ? hostCurrencyCode : homeCurrencyCode

  function handleSubmit() {
    if (!description || !amount) return
    onSave({
      description,
      category,
      amount: parseFloat(amount),
      currency_code: currencyCode,
      currency_context: currencyContext,
      // In production, convert via a live FX rate API here before saving.
      amount_in_home_currency: currencyContext === 'home' ? parseFloat(amount) : null,
      expense_date: expenseDate,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Log expense</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            placeholder="What did you spend on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <select
              value={currencyContext}
              onChange={(e) => setCurrencyContext(e.target.value as CurrencyContext)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            >
              <option value="host">Host ({hostCurrencyCode})</option>
              <option value="home">Home ({homeCurrencyCode})</option>
            </select>
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            {(Object.keys(CATEGORY_COLORS) as ExpenseCategory[]).map((c) => (
              <option key={c} value={c}>
                {c.replace('_', ' ')}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!description || !amount}
          className="mt-4 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          Save expense
        </button>
      </div>
    </div>
  )
}
