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
import { Plus, Trash2, CheckCircle } from 'lucide-react'

export default function Financial() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('expense')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [contactId, setContactId] = useState('')
  const [amount, setAmount] = useState(0)
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState('')
  const [installments, setInstallments] = useState(1)
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // baixa
  const [baixaOpen, setBaixaOpen] = useState(false)
  const [baixaItem, setBaixaItem] = useState<any>(null)
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [juros, setJuros] = useState(0)
  const [desconto, setDesconto] = useState(0)

  const { data: txs } = useQuery({
    queryKey: ['financial', filterType, filterStatus, from, to],
    queryFn: async () => {
      let q = supabase.from('financial_transactions').select('*,contacts(name)').order('due_date')
      if (filterType !== 'all') q = q.eq('type', filterType)
      if (filterStatus !== 'all') q = q.eq('status', filterStatus)
      if (from) q = q.gte('due_date', from)
      if (to) q = q.lte('due_date', to)
      return (await q).data || []
    },
  })
  const { data: contacts } = useQuery({ queryKey: ['contacts'], queryFn: async () => (await supabase.from('contacts').select('*')).data || [] })

  const save = useMutation({
    mutationFn: async () => {
      const n = installments > 1 ? installments : 1
      const baseDate = new Date(dueDate)
      for (let i = 0; i < n; i++) {
        const d = new Date(baseDate)
        d.setMonth(d.getMonth() + i)
        const dd = d.toISOString().slice(0, 10)
        const parcelAmount = n > 1 ? amount / n : amount
        const { error } = await supabase.from('financial_transactions').insert({
          type, description: n > 1 ? `${description} (${i + 1}/${n})` : description,
          category, contact_id: contactId || null, amount: parcelAmount,
          issue_date: issueDate, due_date: dd, status: 'pending', payment_method: paymentMethod,
          installments: n, installment_number: i + 1,
        })
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial'] }); toast.success('Lançado'); setOpen(false) },
    onError: (e: any) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('financial_transactions').delete().eq('id', id); if (error) throw error },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial'] }); toast.success('Excluído') },
  })

  const baixar = useMutation({
    mutationFn: async () => {
      if (!baixaItem) return
      const finalAmt = Number(baixaItem.amount) + juros - desconto
      const { error } = await supabase.from('financial_transactions').update({ status: 'paid', payment_date: payDate, amount: finalAmt }).eq('id', baixaItem.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial'] }); toast.success('Baixa realizada'); setBaixaOpen(false) },
  })

  function openNew() {
setType('expense'); setDescription(''); setCategory(''); setContactId(''); setAmount(0); setIssueDate(new Date().toISOString().slice(0, 10)); setDueDate(new Date().toISOString().slice(0, 10)); setPaymentMethod(''); setInstallments(1); setOpen(true)
  }

  const statusColor: any = { pending: 'secondary', paid: 'default', overdue: 'destructive' }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Financeiro</h2>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Lançamento</Button>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="grid md:grid-cols-5 gap-3">
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="overdue">Atrasado</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(txs || []).map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell><Badge variant={t.type === 'income' ? 'default' : 'destructive'}>{t.type}</Badge></TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell>{t.contacts?.name}</TableCell>
                  <TableCell>{dateBR(t.due_date)}</TableCell>
                  <TableCell className={t.type === 'income' ? 'text-green-600' : 'text-red-600'}>{money(t.amount)}</TableCell>
                  <TableCell><Badge variant={statusColor[t.status] || 'secondary'}>{t.status}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    {t.status !== 'paid' && <Button size="icon" variant="ghost" onClick={() => { setBaixaItem(t); setPayDate(new Date().toISOString().slice(0, 10)); setJuros(0); setDesconto(0); setBaixaOpen(true) }}><CheckCircle className="h-4 w-4" /></Button>}
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v: any) => setType(v ?? "")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
              <div>
                <Label>Contato</Label>
                <Select value={contactId} onValueChange={(v: any) => setContactId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(contacts || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Valor</Label><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
              <div><Label>Emissão</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
              <div><Label>Vencimento</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Forma Pagamento</Label><Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} /></div>
              <div><Label>Parcelas</Label><Input type="number" value={installments} onChange={(e) => setInstallments(Number(e.target.value))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={baixaOpen} onOpenChange={setBaixaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dar Baixa</DialogTitle></DialogHeader>
          <Label>Data Pagamento</Label>
          <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          <Label>Juros</Label>
          <Input type="number" value={juros} onChange={(e) => setJuros(Number(e.target.value))} />
          <Label>Desconto</Label>
          <Input type="number" value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} />
          <div className="text-sm">Valor final: {money(Number(baixaItem?.amount || 0) + juros - desconto)}</div>
          <Button onClick={() => baixar.mutate()}>Confirmar</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
