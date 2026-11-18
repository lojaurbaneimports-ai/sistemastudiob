import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { money } from '@/lib/format'

const empty = { sku: '', name: '', category: '', unit: 'UN', cost_price: 0, sale_price: 0, profit_margin: 0, stock_qty: 0, min_stock: 0, is_service: false }

function margin(cost: number, sale: number) {
  if (!cost || cost <= 0) return 0
  return ((sale - cost) / cost) * 100
}

export default function Products() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(empty)

  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await supabase.from('products').select('*').order('name')).data || [],
  })

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, profit_margin: margin(Number(form.cost_price), Number(form.sale_price)) }
      if (editing) {
        const { error } = await supabase.from('products').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('products').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Salvo'); setOpen(false) },
    onError: (e: any) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('products').delete().eq('id', id); if (error) throw error },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Excluído') },
  })

  function openNew() { setEditing(null); setForm(empty); setOpen(true) }
  function openEdit(p: any) { setEditing(p); setForm({ ...p }); setOpen(true) }
  function setField(k: string, v: any) {
    const next = { ...form, [k]: v }
    if (k === 'cost_price' || k === 'sale_price') next.profit_margin = margin(Number(next.cost_price), Number(next.sale_price))
    setForm(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Produtos e Serviços</h2>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Unid</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Venda</TableHead>
                <TableHead>Margem</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Mín</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={10}>Carregando...</TableCell></TableRow>}
              {(data || []).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>{p.sku}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell>{money(p.cost_price)}</TableCell>
                  <TableCell>{money(p.sale_price)}</TableCell>
                  <TableCell>{Number(p.profit_margin).toFixed(2)}%</TableCell>
                  <TableCell>{p.is_service ? '-' : p.stock_qty}</TableCell>
                  <TableCell>{p.min_stock}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Produto</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>SKU</Label><Input value={form.sku || ''} onChange={(e) => setField('sku', e.target.value)} /></div>
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setField('name', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Categoria</Label><Input value={form.category || ''} onChange={(e) => setField('category', e.target.value)} /></div>
              <div><Label>Unidade</Label>
                <select className="w-full border rounded-md p-2 bg-background" value={form.unit} onChange={(e) => setField('unit', e.target.value)}>
                  <option>UN</option><option>KG</option><option>CX</option><option>HR</option><option>LT</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <input type="checkbox" checked={form.is_service} onChange={(e) => setField('is_service', e.target.checked)} />
                <Label>Serviço</Label>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Preço Custo</Label><Input type="number" value={form.cost_price} onChange={(e) => setField('cost_price', Number(e.target.value))} /></div>
              <div><Label>Preço Venda</Label><Input type="number" value={form.sale_price} onChange={(e) => setField('sale_price', Number(e.target.value))} /></div>
              <div><Label>Margem %</Label><Input value={Number(form.profit_margin).toFixed(2)} readOnly /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Estoque Atual</Label><Input type="number" value={form.stock_qty} onChange={(e) => setField('stock_qty', Number(e.target.value))} /></div>
              <div><Label>Estoque Mínimo</Label><Input type="number" value={form.min_stock} onChange={(e) => setField('min_stock', Number(e.target.value))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
