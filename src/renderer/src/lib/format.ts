export function fmtBRL(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export function fmtPct(similaridade: number): string {
  return `${Math.round(similaridade * 100)}%`
}

export function fmtNum(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR')
}
