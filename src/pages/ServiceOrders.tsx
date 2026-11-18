import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { money, dateBR } from '@/lib/format'
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react'

type SOItem = { product_id: string; description: string; quantity: number; unit_price: number; total: number; item_type: string }

const statuses = ['open', 'in_analysis', 'awaiting_approval', 'in_progress', 'completed', 'delivered']

export default function ServiceOrders() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [customerId, setCustomerId] = useState('')
  const [equipment, setEquipment] = useState('')
  const [serial, setSerial] = useState('')
  const [issue, setIssue] = useState('')
  const [report, setReport] = useState('')
  const [technician, setTechnician] = useState('')
  const [deadline, setDeadline] = useState('')
  const [status, setStatus] = useState('open')
  const [items, setItems] = useState<SOItem[]>([])
  const [prodId, setProdId] = useState('')
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(0)
  const [desc, setDesc] = useState('')
  const [itemType, setItemType] = useState('service')

  const { data: orders } = useQuery({ queryKey: ['service_orders'], queryFn: async () => (await supabase.from('service_orders').select('*,contacts(name)').order('created_at', { ascending: false })).data || [] })
  const { data: customers } = useQuery({ queryKey: ['contacts'], queryFn: async () => (await supabase.from('contacts').select('*').in('type', ['customer', 'both'])).data || [] })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await supabase.from('products').select('*')).data || [] })
  const { data: technicians } = useQuery({ queryKey: ['employees'], queryFn: async () => (await supabase.from('employees').select('*').eq('status', 'active')).data || [] })

  const total = items.reduce((a, i) => a + i.total, 0)

  function addItem() {
    const p = (products || []).find((x: any) => x.id === prodId)
    const up = price || Number(p?.sale_price || 0)
    const d = desc || p?.name || ''
    setItems([...items, { product_id: prodId, description: d, quantity: qty, unit_price: up, total: up * qty, item_type: itemType }])
    setProdId(''); setQty(1); setPrice(0); setDesc('')
  }
  function removeItem(idx: number) { setItems(items.filter((_, i) => i !== idx)) }

  const save = useMutation({
    mutationFn: async () => {
      const payload = { customer_id: customerId || null, equipment, serial_number: serial, reported_issue: issue, technical_report: report, technician, delivery_deadline: deadline || null, status, total }
      let soId = editing?.id
      if (editing) {
        const { error } = await supabase.from('service_orders').update(payload).eq('id', editing.id)
        if (error) throw error
        await supabase.from('service_order_items').delete().eq('service_order_id', editing.id)
      } else {
        const { data, error } = await supabase.from('service_orders').insert(payload).select().single()
        if (error) throw error
        soId = data.id
      }
      if (items.length) {
        const rows = items.map((i) => ({ service_order_id: soId, product_id: i.product_id || null, description: i.description, quantity: i.quantity, unit_price: i.unit_price, total: i.total, item_type: i.item_type }))
        const { error } = await supabase.from('service_order_items').insert(rows)
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service_orders'] }); toast.success('Salvo'); setOpen(false) },
    onError: (e: any) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('service_orders').delete().eq('id', id); if (error) throw error },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service_orders'] }); toast.success('Excluído') },
  })

  const faturar = useMutation({
    mutationFn: async (so: any) => {
      const { error } = await supabase.rpc('invoice_service_order', { p_service_order_id: so.id })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service_orders'] }); qc.invalidateQueries({ queryKey: ['financial'] }); toast.success('Faturado') },
    onError: (e: any) => toast.error(e.message),
  })

  function openNew() {
    setEditing(null); setCustomerId(''); setEquipment(''); setSerial(''); setIssue(''); setReport(''); setTechnician(''); setDeadline(''); setStatus('open'); setItems([]); setOpen(true)
  }
  function openEdit(so: any) {
    setEditing(so); setCustomerId(so.customer_id || ''); setEquipment(so.equipment || ''); setSerial(so.serial_number || ''); setIssue(so.reported_issue || ''); setReport(so.technical_report || ''); setTechnician(so.technician || ''); setDeadline(so.delivery_deadline || ''); setStatus(so.status); setItems([])
    supabase.from('service_order_items').select('*').eq('service_order_id', so.id).then(({ data }) => {
      setItems((data || []).map((i: any) => ({ product_id: i.product_id || '', description: i.description || '', quantity: Number(i.quantity), unit_price: Number(i.unit_price), total: Number(i.total), item_type: i.item_type || 'service' })))
    })
    setOpen(true)
  }

  const statusColor: any = { open: 'secondary', in_analysis: 'default', awaiting_approval: 'outline', in_progress: 'default', completed: 'default', delivered: 'default' }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Ordens de Serviço</h2>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova OS</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Equipamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orders || []).map((so: any) => (
                <TableRow key={so.id}>
                  <TableCell>{so.contacts?.name}</TableCell>
                  <TableCell>{so.equipment}</TableCell>
                  <TableCell><Badge variant={statusColor[so.status] || 'secondary'}>{so.status}</Badge></TableCell>
                  <TableCell>{dateBR(so.delivery_deadline)}</TableCell>
                  <TableCell>{money(so.total)}</TableCell>
                  <TableCell className="flex gap-1 flex-wrap">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(so)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(so.id)}><Trash2 className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => faturar.mutate(so)}><DollarSign className="h-4 w-4 mr-1" />Faturar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nova'} OS</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cliente</Label>
                <Select value={customerId} onValueChange={(v: any) => setCustomerId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(customers || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Técnico</Label>
                <Select value={technician} onValueChange={(v: any) => setTechnician(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(technicians || []).map((t: any) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Equipamento</Label><Input value={equipment} onChange={(e) => setEquipment(e.target.value)} /></div>
              <div><Label>Nº Série/Placa</Label><Input value={serial} onChange={(e) => setSerial(e.target.value)} /></div>
            </div>
            <div><Label>Defeito/Solicitação</Label><Textarea value={issue} onChange={(e) => setIssue(e.target.value)} /></div>
            <div><Label>Laudo Técnico</Label><Textarea value={report} onChange={(e) => setReport(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prazo Entrega</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v ?? "")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border rounded-md p-3 space-y-2">
              <Label>Itens</Label>
              <div className="grid grid-cols-6 gap-2">
                <Select value={itemType} onValueChange={(v: any) => setItemType(v ?? "")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Serviço</SelectItem>
                    <SelectItem value="part">Peça</SelectItem>
                  </SelectContent>
                </Select>
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
                <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Qtd</TableHead><TableHead>Preço</TableHead><TableHead>Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((it, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{it.item_type}</TableCell>
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
