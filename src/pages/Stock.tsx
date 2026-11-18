import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function Stock() {
  const qc = useQueryClient()
  const [productId, setProductId] = useState('')
  const [type, setType] = useState('in')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await supabase.from('products').select('*').eq('is_service', false).order('name')).data || [] })
  const { data: movements } = useQuery({ queryKey: ['stock_movements'], queryFn: async () => (await supabase.from('stock_movements').select('*,products(name)').order('created_at', { ascending: false }).limit(100)).data || [] })

  const low = (products || []).filter((p: any) => Number(p.stock_qty) <= Number(p.min_stock))

  const move = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error('Selecione produto')
      const p = (products || []).find((x: any) => x.id === productId)
      const delta = type === 'in' ? qty : -qty
      const { error: e1 } = await supabase.from('stock_movements').insert({ product_id: productId, type, quantity: qty, reason })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('products').update({ stock_qty: Number(p.stock_qty) + delta }).eq('id', productId)
      if (e2) throw e2
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['stock_movements'] }); toast.success('Movimentação registrada'); setQty(1); setReason('') },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Estoque</h2>
      {low.length > 0 && (
        <Card className="border-yellow-500">
          <CardHeader><CardTitle className="text-yellow-600">Alertas de Estoque Baixo</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {low.map((p: any) => <li key={p.id}>{p.name} - atual {p.stock_qty} / mín {p.min_stock}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Nova Movimentação</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-5 gap-3 items-end">
          <div>
            <Label>Produto</Label>
            <Select value={productId} onValueChange={(v: any) => setProductId(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{(products || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v: any) => setType(v ?? "")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Entrada</SelectItem>
                <SelectItem value="out">Saída</SelectItem>
                <SelectItem value="adjustment">Ajuste</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Quantidade</Label><Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
          <div><Label>Motivo</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Button onClick={() => move.mutate()} disabled={move.isPending}>Registrar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(movements || []).map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>{new Date(m.created_at).toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{m.products?.name}</TableCell>
                  <TableCell><Badge>{m.type}</Badge></TableCell>
                  <TableCell>{m.quantity}</TableCell>
                  <TableCell>{m.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
