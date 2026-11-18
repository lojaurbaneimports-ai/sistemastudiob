export const money = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const dateBR = (v: string | Date | null | undefined) => {
  if (!v) return ''
  const d = typeof v === 'string' ? new Date(v) : v
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('pt-BR')
}

export const datetimeBR = (v: string | Date | null | undefined) => {
  if (!v) return ''
  const d = typeof v === 'string' ? new Date(v) : v
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleString('pt-BR')
}
