import { useState } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import type { HistoricoItem } from '../../../shared/types'
import { fmtBRL, fmtData } from '../lib/format'
import { Alerta, Button, Card, Empty, Input, Spinner } from '../components/ui'
import { HistoricoView } from '../components/HistoricoView'

export function Buscar() {
  const [termo, setTermo] = useState('')
  const [termoBuscado, setTermoBuscado] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [itens, setItens] = useState<HistoricoItem[] | null>(null)
  const [aberto, setAberto] = useState<number | null>(null)

  async function buscar() {
    const t = termo.trim()
    if (!t) return
    setCarregando(true)
    setErro(null)
    setItens(null)
    setTermoBuscado(t)
    const res = await window.api.buscarLista(t)
    setCarregando(false)
    if (!res.ok) {
      setErro(res.error)
      return
    }
    setItens(res.data)
    setAberto(res.data.length === 1 ? res.data[0]!.item.id : null) // 1 resultado abre direto
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Buscar histórico de preço</h1>
        {itens && (
          <span className="text-sm text-zinc-500">
            {itens.length} correspondência(s) para “{termoBuscado}”
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder='Ex: "bacia", "papel A4", "lápis faber castell"...'
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          autoFocus
        />
        <Button onClick={buscar} disabled={carregando || !termo.trim()}>
          {carregando ? <Spinner /> : <Search className="h-4 w-4" />}
          Buscar
        </Button>
      </div>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      {itens && itens.length === 0 && !carregando && (
        <Empty>
          Nada encontrado para “{termoBuscado}”. Tente outro termo, ou pergunte na aba{' '}
          <strong>Perguntar (IA)</strong>.
        </Empty>
      )}

      <div className="space-y-2">
        {itens?.map((h) => {
          const exp = aberto === h.item.id
          const faixa =
            h.stats.minimo != null && h.stats.maximo != null && h.stats.minimo !== h.stats.maximo
              ? `${fmtBRL(h.stats.minimo)} – ${fmtBRL(h.stats.maximo)}`
              : fmtBRL(h.stats.minimo)
          return (
            <Card key={h.item.id}>
              <button
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setAberto(exp ? null : h.item.id)}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{h.item.nome}</p>
                  <p className="text-xs text-zinc-500">
                    {[h.item.categoria, h.item.unidade_padrao].filter(Boolean).join(' · ') || 'sem categoria'} ·{' '}
                    {h.stats.registros} lance(s) em {h.stats.mapas} licitação(ões)
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{faixa}</p>
                    <p className="text-[11px] text-zinc-400">
                      mediana {fmtBRL(h.stats.mediana)}
                      {h.stats.ultimaData && ` · ${fmtData(h.stats.ultimaData)}`}
                    </p>
                  </div>
                  {exp ? (
                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
              </button>
              {exp && (
                <div className="mt-4 border-t border-zinc-100 pt-4">
                  <HistoricoView historico={h} ocultarCabecalho />
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
