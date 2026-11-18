import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { money } from '@/lib/format'

function toCSV(rows: any[], cols: string[]) {
  const header = cols.join(',')
  const body = rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(',')).join('\n')
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'relatorio.csv'; a.click(); URL.revokeObjectURL(url)
}

export default function Reports() {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))

  const { data: sales } = useQuery({ queryKey: ['rep_sales', from, to], queryFn: async () => (await supabase.from('sales').select('*,sale_items(*)').gte('created_at', from).lte('created_at', to + 'T23:59:59')).data || [] })
  const { data: txs } = useQuery({ queryKey: ['rep_txs', from, to], queryFn: async () => (await supabase.from('financial_transactions').select('*').gte('due_date', from).lte('due_date', to)).data || [] })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await supabase.from('products').select('*')).data || [] })
  const { data: entries } = useQuery({ queryKey: ['time_entries'], queryFn: async () => (await supabase.from('time_entries').select('*,employees(name)').order('entry_time')).data || [] })
  const { data: orders } = useQuery({ queryKey: ['service_orders'], queryFn: async () => (await supabase.from('service_orders').select('*,contacts(name)').order('created_at', { ascending: false })).data || [] })

  // DRE by month
  const dreMap: Record<string, { receitas: number; despesas: number }> = {}
  ;(txs || []).forEach((t: any) => {
    const m = (t.due_date || '').slice(0, 7)
    if (!dreMap[m]) dreMap[m] = { receitas: 0, despesas: 0 }
    if (t.type === 'income') dreMap[m].receitas += Number(t.amount)
    else dreMap[m].despesas += Number(t.amount)
  })
  const dreRows = Object.entries(dreMap).map(([m, v]) => ({ mes: m, receitas: v.receitas, despesas: v.despesas, saldo: v.receitas - v.despesas }))

  // vendas por forma pagamento
  const payMap: Record<string, number> = {}
  ;(sales || []).forEach((s: any) => { const k = s.payment_method || 'n/a'; payMap[k] = (payMap[k] || 0) + Number(s.total) })
  const payRows = Object.entries(payMap).map(([k, v]) => ({ forma: k, total: v }))

  // mais vendidos
  const soldMap: Record<string, { name: string; qty: number; total: number }> = {}
  ;(sales || []).forEach((s: any) => {
    ;(s.sale_items || []).forEach((it: any) => {
      const p = (products || []).find((x: any) => x.id === it.product_id)
      const key = it.product_id || it.id
      if (!soldMap[key]) soldMap[key] = { name: p?.name || 'Item', qty: 0, total: 0 }
      soldMap[key].qty += Number(it.quantity)
      soldMap[key].total += Number(it.total)
    })
  })
  const soldRows = Object.values(soldMap).sort((a, b) => b.qty - a.qty)

  // horas por colaborador
  const hoursMap: Record<string, number> = {}
  const byEmpDay: Record<string, Record<string, any>> = {}
  ;(entries || []).forEach((e: any) => {
    const emp = e.employees?.name || e.employee_id
    const day = e.entry_time.slice(0, 10)
    if (!byEmpDay[emp]) byEmpDay[emp] = {}
    if (!byEmpDay[emp][day]) byEmpDay[emp][day] = {}
    byEmpDay[emp][day][e.type] = e.entry_time
  })
  Object.entries(byEmpDay).forEach(([emp, days]) => {
    let total = 0
    Object.values(days).forEach((d: any) => {
      if (d.entry && d.exit) {
        let work = new Date(d.exit).getTime() - new Date(d.entry).getTime()
        if (d.lunch_out && d.lunch_return) work -= (new Date(d.lunch_return).getTime() - new Date(d.lunch_out).getTime())
        total += work / 3600000
      }
    })
    hoursMap[emp] = total
  })
  const hoursRows = Object.entries(hoursMap).map(([k, v]) => ({ colaborador: k, horas: Number(v.toFixed(2)) }))

  // OS por status/tecnico
  const osStatusMap: Record<string, number> = {}
  const osTechMap: Record<string, number> = {}
  ;(orders || []).forEach((o: any) => {
    osStatusMap[o.status] = (osStatusMap[o.status] || 0) + 1
    const t = o.technician || 'N/A'
    osTechMap[t] = (osTechMap[t] || 0) + 1
  })
  const osStatusRows = Object.entries(osStatusMap).map(([k, v]) => ({ status: k, quantidade: v }))
  const osTechRows = Object.entries(osTechMap).map(([k, v]) => ({ tecnico: k, quantidade: v }))

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-end">
        <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <Button onClick={() => window.print()}>Imprimir</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>DRE / Fluxo de Caixa</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead>Receitas</TableHead><TableHead>Despesas</TableHead><TableHead>Saldo</TableHead></TableRow></TableHeader>
            <TableBody>
              {dreRows.map((r) => <TableRow key={r.mes}><TableCell>{r.mes}</TableCell><TableCell>{money(r.receitas)}</TableCell><TableCell>{money(r.despesas)}</TableCell><TableCell>{money(r.saldo)}</TableCell></TableRow>)}
            </TableBody>
          </Table>
          <Button size="sm" className="m-2" onClick={() => toCSV(dreRows, ['mes', 'receitas', 'despesas', 'saldo'])}>Exportar CSV</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vendas por Forma de Pagamento</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Forma</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {payRows.map((r) => <TableRow key={r.forma}><TableCell>{r.forma}</TableCell><TableCell>{money(r.total)}</TableCell></TableRow>)}
            </TableBody>
          </Table>
          <Button size="sm" className="m-2" onClick={() => toCSV(payRows, ['forma', 'total'])}>Exportar CSV</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Produtos Mais Vendidos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Qtd</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {soldRows.map((r, i) => <TableRow key={i}><TableCell>{r.name}</TableCell><TableCell>{r.qty}</TableCell><TableCell>{money(r.total)}</TableCell></TableRow>)}
            </TableBody>
          </Table>
          <Button size="sm" className="m-2" onClick={() => toCSV(soldRows, ['name', 'qty', 'total'])}>Exportar CSV</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Posição de Estoque</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Estoque</TableHead><TableHead>Mín</TableHead><TableHead>Custo</TableHead><TableHead>Venda</TableHead></TableRow></TableHeader>
            <TableBody>
              {(products || []).filter((p: any) => !p.is_service).map((p: any) => <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell>{p.stock_qty}</TableCell><TableCell>{p.min_stock}</TableCell><TableCell>{money(p.cost_price)}</TableCell><TableCell>{money(p.sale_price)}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Horas Trabalhadas por Colaborador</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Horas</TableHead></TableRow></TableHeader>
            <TableBody>
              {hoursRows.map((r, i) => <TableRow key={i}><TableCell>{r.colaborador}</TableCell><TableCell>{r.horas}</TableCell></TableRow>)}
            </TableBody>
          </Table>
          <Button size="sm" className="m-2" onClick={() => toCSV(hoursRows, ['colaborador', 'horas'])}>Exportar CSV</Button>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>OS por Status</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Qtd</TableHead></TableRow></TableHeader>
              <TableBody>
                {osStatusRows.map((r, i) => <TableRow key={i}><TableCell>{r.status}</TableCell><TableCell>{r.quantidade}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>OS por Técnico</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Técnico</TableHead><TableHead>Qtd</TableHead></TableRow></TableHeader>
              <TableBody>
                {osTechRows.map((r, i) => <TableRow key={i}><TableCell>{r.tecnico}</TableCell><TableCell>{r.quantidade}</TableCell></TableRow>)}
              </TableBody>
            </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
