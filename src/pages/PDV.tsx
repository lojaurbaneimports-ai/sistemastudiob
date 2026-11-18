import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { money } from '@/lib/format'
import { Trash2, Search } from 'lucide-react'

type CartItem = { product: any; qty: number }

export default function PDV() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerId, setCustomerId] = useState('')
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value')
  const [discount, setDiscount] = useState(0)
  const [payMethod, setPayMethod] = useState('cash')
  const [cashReceived, setCashReceived] = useState(0)
  const [openReg, setOpenReg] = useState(false)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [closeBalance, setCloseBalance] = useState(0)
  const [closeOpen, setCloseOpen] = useState(false)
  const [supplyAmt, setSupplyAmt] = useState(0)
  const [supplyDesc, setSupplyDesc] = useState('')
  const [supplyOpen, setSupplyOpen] = useState(false)

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await supabase.from('products').select('*').eq('is_service', false)).data || [] })
  const { data: customers } = useQuery({ queryKey: ['contacts'], queryFn: async () => (await supabase.from('contacts').select('*').in('type', ['customer', 'both'])).data || [] })
  const { data: register } = useQuery({ queryKey: ['cash_register_open'], queryFn: async () => (await supabase.from('cash_registers').select('*').eq('status', 'open').order('opened_at', { ascending: false }).limit(1)).data?.[0] || null })

  const filteredProducts = (products || []).filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase()))

  const subtotal = cart.reduce((a, c) => a + Number(c.product.sale_price) * c.qty, 0)
  const discountValue = discountType === 'percent' ? subtotal * (discount / 100) : discount
  const total = Math.max(0, subtotal - discountValue)
  const change = payMethod === 'cash' ? Math.max(0, cashReceived - total) : 0

  function addToCart(p: any) {
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === p.id)
      if (ex) return prev.map((c) => c.product.id === p.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { product: p, qty: 1 }]
    })
  }
  function updateQty(id: string, qty: number) {
    setCart((prev) => prev.map((c) => c.product.id === id ? { ...c, qty } : c))
  }
  function removeItem(id: string) { setCart((prev) => prev.filter((c) => c.product.id !== id)) }

  const openRegister = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('cash_registers').insert({ opening_balance: openingBalance, status: 'open' })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash_register_open'] }); toast.success('Caixa aberto'); setOpenReg(false) },
  })

  const closeRegister = useMutation({
    mutationFn: async () => {
      if (!register) throw new Error('Sem caixa aberto')
      const { error } = await supabase.from('cash_registers').update({ status: 'closed', closed_at: new Date().toISOString(), closing_balance: closeBalance, notes: 'Fechamento' }).eq('id', register.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash_register_open'] }); toast.success('Caixa fechado'); setCloseOpen(false) },
  })

  const supply = useMutation({
    mutationFn: async () => {
      if (!register) throw new Error('Sem caixa aberto')
      const { error } = await supabase.from('cash_movements').insert({ cash_register_id: register.id, type: 'in', amount: supplyAmt, description: supplyDesc || 'Suprimento' })
      if (error) throw error
    },
    onSuccess: () => { toast.success('Suprimento registrado'); setSupplyOpen(false); setSupplyAmt(0); setSupplyDesc('') },
  })

  const finalizeSale = useMutation({
    mutationFn: async () => {
      if (!register) throw new Error('Abra o caixa primeiro')
      if (cart.length === 0) throw new Error('Carrinho vazio')
      const { data: sale, error } = await supabase.from('sales').insert({
        customer_id: customerId || null,
        cash_register_id: register.id,
        subtotal, discount: discountValue, total, payment_method: payMethod,
      }).select().single()
      if (error) throw error
      const items = cart.map((c) => ({ sale_id: sale.id, product_id: c.product.id, quantity: c.qty, unit_price: c.product.sale_price, total: Number(c.product.sale_price) * c.qty }))
      const { error: e2 } = await supabase.from('sale_items').insert(items)
      if (e2) throw e2
      // stock
      for (const c of cart) {
        await supabase.from('products').update({ stock_qty: Number(c.product.stock_qty) - c.qty }).eq('id', c.product.id)
        await supabase.from('stock_movements').insert({ product_id: c.product.id, type: 'out', quantity: c.qty, reason: 'Venda PDV', reference: sale.id })
      }
      // cash movement
      await supabase.from('cash_movements').insert({ cash_register_id: register.id, type: 'in', amount: total, description: 'Venda PDV' })
      // financial
      await supabase.from('financial_transactions').insert({ type: 'income', description: 'Venda PDV', category: 'Vendas', contact_id: customerId || null, amount: total, issue_date: new Date().toISOString().slice(0, 10), due_date: new Date().toISOString().slice(0, 10), payment_date: new Date().toISOString().slice(0, 10), status: 'paid', payment_method: payMethod })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['cash_register_open'] }); toast.success('Venda finalizada'); setCart([]); setDiscount(0); setCashReceived(0) },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">PDV Caixa</h2>
        <div className="flex gap-2">
          {!register && <Button onClick={() => setOpenReg(true)}>Abrir Caixa</Button>}
          {register && <>
            <Button variant="outline" onClick={() => setSupplyOpen(true)}>Suprimento</Button>
            <Button variant="destructive" onClick={() => setCloseOpen(true)}>Fechar Caixa</Button>
          </>}
        </div>
      </div>
      {register && <p className="text-sm text-muted-foreground">Caixa aberto desde {new Date(register.opened_at).toLocaleString('pt-BR')} | Saldo inicial {money(register.opening_balance)}</p>}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Produtos</CardTitle></CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar produto..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
              {filteredProducts.map((p: any) => (
                <Button key={p.id} variant="outline" className="justify-start h-auto py-2" onClick={() => addToCart(p)}>
                  <div className="text-left">
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{money(p.sale_price)} | Est: {p.stock_qty}</div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Carrinho</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Cliente (opcional)</Label>
              <Select value={customerId} onValueChange={(v: any) => setCustomerId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem cliente</SelectItem>
                  {(customers || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qtd</TableHead><TableHead>Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {cart.map((c) => (
                  <TableRow key={c.product.id}>
                    <TableCell className="text-sm">{c.product.name}</TableCell>
                    <TableCell><Input type="number" className="w-16" value={c.qty} onChange={(e) => updateQty(c.product.id, Number(e.target.value))} /></TableCell>
                    <TableCell>{money(Number(c.product.sale_price) * c.qty)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => removeItem(c.product.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Desconto</Label>
                <div className="flex gap-1">
                  <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
                  <Select value={discountType} onValueChange={(v: any) => setDiscountType((v ?? "value") as any)}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="value">R$</SelectItem>
                      <SelectItem value="percent">%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Forma Pagamento</Label>
                <Select value={payMethod} onValueChange={(v: any) => setPayMethod(v ?? "")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="credit">Cartão Crédito</SelectItem>
                    <SelectItem value="debit">Cartão Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {payMethod === 'cash' && (
              <div><Label>Valor Recebido</Label><Input type="number" value={cashReceived} onChange={(e) => setCashReceived(Number(e.target.value))} /></div>
            )}
            <div className="border-t pt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              <div className="flex justify-between"><span>Desconto</span><span>{money(discountValue)}</span></div>
              <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{money(total)}</span></div>
              {payMethod === 'cash' && <div className="flex justify-between text-green-600"><span>Troco</span><span>{money(change)}</span></div>}
            </div>
            <Button className="w-full" onClick={() => finalizeSale.mutate()} disabled={finalizeSale.isPending || cart.length === 0}>Finalizar Venda</Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={openReg} onOpenChange={setOpenReg}>
        <DialogContent>
          <DialogHeader><DialogTitle>Abrir Caixa</DialogTitle></DialogHeader>
          <Label>Saldo Inicial</Label>
          <Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(Number(e.target.value))} />
          <Button onClick={() => openRegister.mutate()}>Abrir</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fechar Caixa</DialogTitle></DialogHeader>
          <Label>Saldo de Fechamento</Label>
          <Input type="number" value={closeBalance} onChange={(e) => setCloseBalance(Number(e.target.value))} />
          <Button variant="destructive" onClick={() => closeRegister.mutate()}>Fechar</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={supplyOpen} onOpenChange={setSupplyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Suprimento</DialogTitle></DialogHeader>
          <Label>Valor</Label>
          <Input type="number" value={supplyAmt} onChange={(e) => setSupplyAmt(Number(e.target.value))} />
          <Label>Descrição</Label>
          <Input value={supplyDesc} onChange={(e) => setSupplyDesc(e.target.value)} />
          <Button onClick={() => supply.mutate()}>Registrar</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
