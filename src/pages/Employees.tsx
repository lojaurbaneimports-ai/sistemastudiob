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
import { toast } from 'sonner'
import { money } from '@/lib/format'
import { Pencil, Trash2, Plus } from 'lucide-react'

type Emp = any

const empty = { name: '', position: '', department: '', daily_hours: 8, hourly_rate: 0, salary: 0, status: 'active' }

export default function Employees() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Emp | null>(null)
  const [form, setForm] = useState<any>(empty)

  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => (await supabase.from('employees').select('*').order('name')).data || [],
  })

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from('employees').update(form).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('employees').insert(form)
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Salvo'); setOpen(false) },
    onError: (e: any) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('employees').delete().eq('id', id); if (error) throw error },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Excluído') },
    onError: (e: any) => toast.error(e.message),
  })

  function openNew() { setEditing(null); setForm(empty); setOpen(true) }
  function openEdit(e: Emp) { setEditing(e); setForm({ ...e }); setOpen(true) }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Colaboradores</h2>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Carga Diária</TableHead>
                <TableHead>Salário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7}>Carregando...</TableCell></TableRow>}
              {(data || []).map((e: Emp) => (
                <TableRow key={e.id}>
                  <TableCell>{e.name}</TableCell>
                  <TableCell>{e.position}</TableCell>
                  <TableCell>{e.department}</TableCell>
                  <TableCell>{e.daily_hours}h</TableCell>
                  <TableCell>{money(e.salary)}</TableCell>
                  <TableCell><Badge variant={e.status === 'active' ? 'default' : 'secondary'}>{e.status}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Colaborador</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cargo</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
              <div><Label>Departamento</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Carga Diária</Label><Input type="number" value={form.daily_hours} onChange={(e) => setForm({ ...form, daily_hours: Number(e.target.value) })} /></div>
              <div><Label>Valor/Hora</Label><Input type="number" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })} /></div>
              <div><Label>Salário</Label><Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Status</Label>
              <select className="w-full border rounded-md p-2 bg-background" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
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
