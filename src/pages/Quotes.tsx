import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { money, dateBR } from '@/lib/format'
import { Plus, Pencil, Trash2, ShoppingCart, Wrench } from 'lucide-react'

type QItem = { product_id: string; description: string; quantity: number; unit_price: number; total: number }

export default function Quotes() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [customerId, setCustomerId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [status, setStatus] = useState('pending')
  const [discount, setDiscount] = useState(0)
  const [paymentTerms, setPaymentTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<QItem[]>([])
  const [prodId, setProdId] = useState('')
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(0)
  const [desc, setDesc] = useState('')

  const { data: quotes } = useQuery({ queryKey: ['quotes'], queryFn: async () => (await supabase.from('quotes').select('*,contacts(name)').order('created_at', { ascending: false })).data || [] })
  const { data: customers } = useQuery({ queryKey: ['contacts'], queryFn: async () => (await supabase.from('contacts').select('*').in('type', ['customer', 'both'])).data || [] })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await supabase.from('products').select('*')).data || [] })

  const subtotal = items.reduce((a, i) => a + i.total, 0)
  const total = Math.max(0, subtotal - discount)

  function addItem() {
    if (!desc && !prodId) return
    const p = (products || []).find((x: any) => x.id === prodId)
    const up = price || Number(p?.sale_price || 0)
    const d = desc || p?.name || ''
    setItems([...items, { product_id: prodId, description: d, quantity: qty, unit_price: up, total: up * qty }])
    setProdId(''); setQty(1); setPrice(0); setDesc('')
  }
  function removeItem(idx: number) { setItems(items.filter((_, i) => i !== idx)) }

  const save = useMutation({
    mutationFn: async () => {
      const payload = { customer_id: customerId || null, valid_until: validUntil || null, status, subtotal, discount, total, payment_terms: paymentTerms, notes }
      let quoteId = editing?.id
      if (editing) {
        const { error } = await supabase.from('quotes').update(payload).eq('id', editing.id)
        if (error) throw error
        await supabase.from('quote_items').delete().eq('quote_id', editing.id)
      } else {
        const { data, error } = await supabase.from('quotes').insert(payload).select().single()
        if (error) throw error
        quoteId = data.id
      }
      if (items.length) {
        const rows = items.map((i) => ({ quote_id: quoteId, product_id: i.product_id || null, description: i.description, quantity: i.quantity, unit_price: i.unit_price, total: i.total }))
        const { error } = await supabase.from('quote_items').insert(rows)
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); toast.success('Salvo'); setOpen(false) },
    onError: (e: any) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('quotes').delete().eq('id', id); if (error) throw error },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); toast.success('Excluído') },
  })

  const convertSale = useMutation({
    mutationFn: async (q: any) => {
      const { data: qi } = await supabase.from('quote_items').select('*').eq('quote_id', q.id)
      const { data: sale, error } = await supabase.from('sales').insert({ customer_id: q.customer_id, subtotal: q.subtotal, discount: q.discount, total: q.total, payment_method: 'pending' }).select().single()
      if (error) throw error
      if (qi && qi.length) {
        await supabase.from('sale_items').insert(qi.map((i: any) => ({ sale_id: sale.id, product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, total: i.total })))
        for (const i of qi) {
          if (i.product_id) {
            const { data: p } = await supabase.from('products').select('stock_qty').eq('id', i.product_id).single()
            if (p) await supabase.from('products').update({ stock_qty: Number(p.stock_qty) - Number(i.quantity) }).eq('id', i.product_id)
            await supabase.from('stock_movements').insert({ product_id: i.product_id, type: 'out', quantity: i.quantity, reason: 'Conversão orçamento', reference: q.id })
          }
        }
      }
      await supabase.from('financial_transactions').insert({ type: 'income', description: 'Orçamento convertido', category: 'Vendas', contact_id: q.customer_id, amount: q.total, issue_date: new Date().toISOString().slice(0, 10), due_date: new Date().toISOString().slice(0, 10), status: 'pending' })
      await supabase.from('quotes').update({ status: 'approved' }).eq('id', q.id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); toast.success('Convertido em venda') },
    onError: (e: any) => toast.error(e.message),
  })

  const convertOS = useMutation({
    mutationFn: async (q: any) => {
      const { data: qi } = await supabase.from('quote_items').select('*').eq('quote_id', q.id)
      const { data: so, error } = await supabase.from('service_orders').insert({ customer_id: q.customer_id, status: 'open', total: q.total, reported_issue: q.notes }).select().single()
      if (error) throw error
      if (qi && qi.length) {
        await supabase.from('service_order_items').insert(qi.map((i: any) => ({ service_order_id: so.id, product_id: i.product_id, description: i.description, quantity: i.quantity, unit_price: i.unit_price, total: i.total, item_type: i.product_id ? 'part' : 'service' })))
      }
      await supabase.from('quotes').update({ status: 'approved' }).eq('id', q.id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); toast.success('Convertido em OS') },
    onError: (e: any) => toast.error(e.message),
  })

  function openNew() {
    setEditing(null); setCustomerId(''); setValidUntil(''); setStatus('pending'); setDiscount(0); setPaymentTerms(''); setNotes(''); setItems([]); setOpen(true)
  }
  function openEdit(q: any) {
    setEditing(q); setCustomerId(q.customer_id || ''); setValidUntil(q.valid_until || ''); setStatus(q.status); setDiscount(Number(q.discount)); setPaymentTerms(q.payment_terms || ''); setNotes(q.notes || ''); setItems([])
    supabase.from('quote_items').select('*').eq('quote_id', q.id).then(({ data }) => {
      setItems((data || []).map((i: any) => ({ product_id: i.product_id || '', description: i.description || '', quantity: Number(i.quantity), unit_price: Number(i.unit_price), total: Number(i.total) })))
    })
    setOpen(true)
  }

  function printQuote() {
    window.print()
  }

  const statusColor: any = { pending: 'secondary', sent: 'default', approved: 'default', rejected: 'destructive' }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Orçamentos</h2>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(quotes || []).map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell>{q.contacts?.name}</TableCell>
                  <TableCell>{dateBR(q.valid_until)}</TableCell>
                  <TableCell><Badge variant={statusColor[q.status] || 'secondary'}>{q.status}</Badge></TableCell>
                  <TableCell>{money(q.total)}</TableCell>
                  <TableCell className="flex gap-1 flex-wrap">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(q)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(q.id)}><Trash2 className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => convertSale.mutate(q)}><ShoppingCart className="h-4 w-4 mr-1" />Venda</Button>
                    <Button size="sm" variant="outline" onClick={() => convertOS.mutate(q)}><Wrench className="h-4 w-4 mr-1" />OS</Button>
                    <Button size="sm" variant="ghost" onClick={() => printQuote()}>Imprimir</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Orçamento</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cliente</Label>
                <Select value={customerId} onValueChange={(v: any) => setCustomerId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(customers || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Validade</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v ?? "")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="sent">Enviado</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="rejected">Recusado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Condições Pagamento</Label><Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></div>
            </div>
            <div className="border rounded-md p-3 space-y-2">
              <Label>Itens</Label>
              <div className="grid grid-cols-5 gap-2">
                <Select value={prodId} onValueChange={(v) => { const val = v ?? ""; setProdId(val); const p = (products || []).find((x: any) => x.id === val); if (p) { setPrice(Number(p.sale_price)); setDesc(p.name) } }}>
                  <SelectTrigger className="col-span-2"><SelectValue placeholder="Produto" /></SelectTrigger>
                  <SelectContent>{(products || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Descrição" value={desc} onChange={(e) => setDesc(e.target.value)} />
                <Input type="number" placeholder="Qtd" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
                <Input type="number" placeholder="Preço" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              </div>
              <Button size="sm" onClick={addItem}>Adicionar Item</Button>
              <Table>
                <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Qtd</TableHead><TableHead>Preço</TableHead><TableHead>Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((it, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{it.description}</TableCell>
                      <TableCell>{it.quantity}</TableCell>
                      <TableCell>{money(it.unit_price)}</TableCell>
                      <TableCell>{money(it.total)}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div><Label>Desconto (R$)</Label><Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div>
            <div><Label>Observações</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="text-right font-bold">Total: {money(total)}</div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
