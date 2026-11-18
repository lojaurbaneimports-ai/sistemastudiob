import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { money } from '@/lib/format'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

async function fetchAll() {
  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const today = new Date().toISOString().slice(0, 10)

  const [sales, receivables, payables, os, products, txs] = await Promise.all([
    supabase.from('sales').select('total,created_at').gte('created_at', startMonth),
    supabase.from('financial_transactions').select('amount,due_date,status').eq('type', 'income').in('status', ['pending']),
    supabase.from('financial_transactions').select('amount,due_date,status').eq('type', 'expense').in('status', ['pending']),
    supabase.from('service_orders').select('id,status').in('status', ['open', 'in_analysis', 'awaiting_approval', 'in_progress']),
    supabase.from('products').select('id,name,stock_qty,min_stock').eq('is_service', false),
    supabase.from('financial_transactions').select('type,amount,created_at,due_date,description,status').gte('created_at', new Date(new Date().setMonth(new Date().getMonth()-6)).toISOString()).order('created_at', { ascending: false }).limit(200),
  ])

  const faturamentoMes = (sales.data || []).reduce((a: number, b: any) => a + Number(b.total || 0), 0)
  const crHoje = (receivables.data || []).filter((r: any) => r.due_date === today).reduce((a: number, b: any) => a + Number(b.amount), 0)
  const crVencidas = (receivables.data || []).filter((r: any) => r.due_date < today).reduce((a: number, b: any) => a + Number(b.amount), 0)
  const cpHoje = (payables.data || []).filter((r: any) => r.due_date === today).reduce((a: number, b: any) => a + Number(b.amount), 0)
  const cpVencidas = (payables.data || []).filter((r: any) => r.due_date < today).reduce((a: number, b: any) => a + Number(b.amount), 0)
  const osAbertas = (os.data || []).length
  const estoqueBaixo = (products.data || []).filter((p: any) => Number(p.stock_qty) <= Number(p.min_stock)).length

  // fluxo 6 meses
  const months: { month: string; entradas: number; saidas: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('pt-BR', { month: 'short' })
    let ent = 0, sai = 0
    ;(txs.data || []).forEach((t: any) => {
      const td = (t.due_date || t.created_at || '').slice(0, 7)
      if (td === key) {
        if (t.type === 'income') ent += Number(t.amount)
        else sai += Number(t.amount)
      }
    })
    months.push({ month: label, entradas: ent, saidas: sai })
  }

  return { faturamentoMes, crHoje, crVencidas, cpHoje, cpVencidas, osAbertas, estoqueBaixo, months, movs: txs.data || [] }
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: fetchAll })

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>

  const kpis = [
    { title: 'Faturamento do Mês', value: money(data?.faturamentoMes), color: 'text-green-600' },
    { title: 'Contas a Receber (Hoje)', value: money(data?.crHoje), color: 'text-blue-600' },
    { title: 'Contas a Receber (Vencidas)', value: money(data?.crVencidas), color: 'text-red-600' },
    { title: 'Contas a Pagar (Hoje)', value: money(data?.cpHoje), color: 'text-orange-600' },
    { title: 'Contas a Pagar (Vencidas)', value: money(data?.cpVencidas), color: 'text-red-600' },
    { title: 'OS Abertas', value: data?.osAbertas ?? 0, color: 'text-purple-600' },
    { title: 'Estoque Baixo', value: data?.estoqueBaixo ?? 0, color: 'text-yellow-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {kpis.map((k) => (
          <Card key={k.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{k.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Fluxo de Caixa (6 meses)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.months || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v: any) => money(v)} />
                <Legend />
                <Bar dataKey="entradas" fill="#22c55e" name="Entradas" />
                <Bar dataKey="saidas" fill="#ef4444" name="Saídas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Últimas Movimentações</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(data?.movs || []).slice(0, 10).map((m: any) => (
                <li key={m.id} className="flex justify-between border-b pb-1">
                  <span className="truncate">{m.description}</span>
                  <span className={m.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                    {m.type === 'income' ? '+' : '-'}{money(m.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
