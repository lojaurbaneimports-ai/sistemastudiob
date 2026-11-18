import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { datetimeBR } from '@/lib/format'

const types = [
  { value: 'entry', label: 'Entrada' },
  { value: 'lunch_out', label: 'Saída Almoço' },
  { value: 'lunch_in', label: 'Volta Almoço' },
  { value: 'exit', label: 'Saída' },
]

export default function TimeClock() {
  const qc = useQueryClient()
  const [now, setNow] = useState(new Date())
  const [empId, setEmpId] = useState('')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const { data: emps } = useQuery({ queryKey: ['employees'], queryFn: async () => (await supabase.from('employees').select('*').eq('status', 'active')).data || [] })

  const { data: entries } = useQuery({
    queryKey: ['time_entries', empId, month],
    queryFn: async () => {
      if (!empId) return []
      const start = month + '-01'
      const end = month + '-31'
      const { data } = await supabase.from('time_entries').select('*').eq('employee_id', empId).gte('entry_time', start).lte('entry_time', end + 'T23:59:59').order('entry_time')
      return data || []
    },
    enabled: !!empId,
  })

  const addEntry = useMutation({
    mutationFn: async (type: string) => {
      if (!empId) throw new Error('Selecione colaborador')
      const { error } = await supabase.from('time_entries').insert({ employee_id: empId, type, entry_time: new Date().toISOString() })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['time_entries'] }); toast.success('Ponto registrado') },
    onError: (e: any) => toast.error(e.message),
  })

  const updateEntry = useMutation({
    mutationFn: async ({ id, entry_time }: any) => {
      const { error } = await supabase.from('time_entries').update({ entry_time }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['time_entries'] }); toast.success('Ajustado') },
  })

  const delEntry = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('time_entries').delete().eq('id', id); if (error) throw error },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['time_entries'] }) },
  })

  // calc hours
  function calcHours() {
    // group by date
    const byDay: Record<string, any> = {}
    ;(entries || []).forEach((e: any) => {
      const d = e.entry_time.slice(0, 10)
      if (!byDay[d]) byDay[d] = {}
      byDay[d][e.type] = e.entry_time
    })
    let totalMin = 0
    Object.values(byDay).forEach((d: any) => {
      if (d.entry && d.exit) {
        const start = new Date(d.entry).getTime()
        const end = new Date(d.exit).getTime()
        let work = end - start
        if (d.lunch_out && d.lunch_in) {
          work -= (new Date(d.lunch_in).getTime() - new Date(d.lunch_out).getTime())
        }
        totalMin += work / 60000
      }
    })
    return (totalMin / 60).toFixed(2)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Relógio</CardTitle></CardHeader>
        <CardContent className="text-center">
          <div className="text-4xl font-mono mb-4">{now.toLocaleTimeString('pt-BR')}</div>
          <div className="max-w-xs mx-auto space-y-3">
            <div>
              <Label>Colaborador</Label>
              <Select value={empId} onValueChange={(v: any) => setEmpId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(emps || []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => (
                <Button key={t.value} onClick={() => addEntry.mutate(t.value)} disabled={!empId || addEntry.isPending}>
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Espelho de Ponto</CardTitle>
            <div className="flex items-center gap-2">
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
              <span className="text-sm">Total horas: {calcHours()}h</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Ajuste</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(entries || []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{types.find((t) => t.value === e.type)?.label || e.type}</TableCell>
                  <TableCell>{datetimeBR(e.entry_time)}</TableCell>
                  <TableCell>
                    <Input type="datetime-local" defaultValue={e.entry_time.slice(0, 16)} onBlur={(ev) => {
                      if (ev.target.value) updateEntry.mutate({ id: e.id, entry_time: new Date(ev.target.value).toISOString() })
                    }} />
                  </TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => delEntry.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

