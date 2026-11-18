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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus } from 'lucide-react'

const empty = { type: 'customer', person_type: 'PF', name: '', trade_name: '', document: '', email: '', phone: '', whatsapp: '', zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', notes: '' }
const digits = (v: string) => v.replace(/\D/g, '')
const documentMask = (v: string, personType: string) => {
  const n = digits(v).slice(0, personType === 'PF' ? 11 : 14)
  return personType === 'PF' ? n.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2') : n.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}
const phoneMask = (v: string) => digits(v).slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
const cepMask = (v: string) => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')

export default function Contacts() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(empty)

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', tab],
    queryFn: async () => {
      let q = supabase.from('contacts').select('*').order('name')
      if (tab !== 'all') q = q.eq('type', tab)
      return (await q).data || []
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from('contacts').update(form).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('contacts').insert(form)
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); toast.success('Salvo'); setOpen(false) },
    onError: (e: any) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('contacts').delete().eq('id', id); if (error) throw error },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); toast.success('Excluído') },
  })

  function openNew() { setEditing(null); setForm(empty); setOpen(true) }
  function openEdit(c: any) { setEditing(c); setForm({ ...c }); setOpen(true) }

  const filtered = (data || []).filter((c: any) => tab === 'all' || c.type === tab)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Clientes e Fornecedores</h2>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo</Button>
      </div>
      <Tabs value={tab} onValueChange={(v: any) => setTab(v ?? "")}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="customer">Clientes</TabsTrigger>
          <TabsTrigger value="supplier">Fornecedores</TabsTrigger>
          <TabsTrigger value="both">Ambos</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6}>Carregando...</TableCell></TableRow>}
              {filtered.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}{c.trade_name ? ` (${c.trade_name})` : ''}</TableCell>
                  <TableCell><Badge>{c.type}</Badge></TableCell>
                  <TableCell>{c.document}</TableCell>
                  <TableCell>{c.phone || c.whatsapp}</TableCell>
                  <TableCell>{c.city}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Contato</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <select className="w-full border rounded-md p-2 bg-background" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="customer">Cliente</option>
                  <option value="supplier">Fornecedor</option>
                  <option value="both">Ambos</option>
                </select>
              </div>
              <div><Label>Pessoa</Label>
                <select className="w-full border rounded-md p-2 bg-background" value={form.person_type} onChange={(e) => setForm({ ...form, person_type: e.target.value })}>
                  <option value="PF">Física</option>
                  <option value="PJ">Jurídica</option>
                </select>
              </div>
            </div>
            <div><Label>Nome/Razão Social</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Nome Fantasia</Label><Input value={form.trade_name || ''} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} /></div>
            <div><Label>CPF/CNPJ</Label><Input value={form.document || ''} onChange={(e) => setForm({ ...form, document: documentMask(e.target.value, form.person_type) })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-mail</Label><Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: phoneMask(e.target.value) })} /></div>
            </div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp || ''} onChange={(e) => setForm({ ...form, whatsapp: phoneMask(e.target.value) })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>CEP</Label><Input value={form.zip_code || ''} onChange={(e) => setForm({ ...form, zip_code: cepMask(e.target.value) })} /></div>
              <div className="col-span-2"><Label>Rua</Label><Input value={form.street || ''} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Número</Label><Input value={form.number || ''} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
              <div><Label>Complemento</Label><Input value={form.complement || ''} onChange={(e) => setForm({ ...form, complement: e.target.value })} /></div>
              <div><Label>Bairro</Label><Input value={form.neighborhood || ''} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cidade</Label><Input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>Estado</Label><Input value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
