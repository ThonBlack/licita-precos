import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import type { FiltrosBusca, HistoricoItem, OpcoesFiltro } from '../../../shared/types'
import { fmtBRL, fmtData } from '../lib/format'
import { Alerta, Button, Card, Empty, Input, Select, Spinner } from '../components/ui'
import { HistoricoView } from '../components/HistoricoView'

const SEM_FILTRO: FiltrosBusca = { fornecedor: '', orgao: '', categoria: '', de: '', ate: '' }

export function Buscar({ filtroInicial }: { filtroInicial?: FiltrosBusca | null }) {
  const [termo, setTermo] = useState('')
  const [filtros, setFiltros] = useState<FiltrosBusca>(SEM_FILTRO)
  const [opcoes, setOpcoes] = useState<OpcoesFiltro>({ fornecedores: [], orgaos: [], categorias: [] })
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [itens, setItens] = useState<HistoricoItem[] | null>(null)
  const [aberto, setAberto] = useState<number | null>(null)
  const [descricao, setDescricao] = useState('')

  useEffect(() => {
    void window.api.opcoesFiltro().then((r) => r.ok && setOpcoes(r.data))
  }, [])

  useEffect(() => {
    if (filtroInicial) {
      const f = { ...SEM_FILTRO, ...filtroInicial }
      setFiltros(f)
      setTermo(filtroInicial.termo ?? '')
      setMostrarFiltros(true)
      void executar(filtroInicial.termo ?? '', f)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroInicial])

  const temFiltro = !!(filtros.fornecedor || filtros.orgao || filtros.categoria || filtros.de || filtros.ate)

  async function executar(t: string, f: FiltrosBusca) {
    setCarregando(true)
    setErro(null)
    setItens(null)
    const usados = [
      f.fornecedor && `fornecedor: ${f.fornecedor}`,
      f.orgao && `escola: ${f.orgao}`,
      f.categoria && `categoria: ${f.categoria}`,
      (f.de || f.ate) && `período: ${f.de || '…'} a ${f.ate || '…'}`
    ].filter(Boolean)
    setDescricao([t && `“${t}”`, ...usados].filter(Boolean).join(' · '))
    const res = await window.api.buscarProdutos({
      termo: t || undefined,
      fornecedor: f.fornecedor || undefined,
      orgao: f.orgao || undefined,
      categoria: f.categoria || undefined,
      de: f.de || undefined,
      ate: f.ate || undefined
    })
    setCarregando(false)
    if (!res.ok) {
      setErro(res.error)
      return
    }
    setItens(res.data)
    setAberto(res.data.length === 1 ? res.data[0]!.item.id : null)
  }

  function buscar() {
    if (!termo.trim() && !temFiltro) return
    void executar(termo.trim(), filtros)
  }

  function limpar() {
    setTermo('')
    setFiltros(SEM_FILTRO)
    setItens(null)
    setDescricao('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Buscar histórico de preço</h1>
        {itens && <span className="text-sm text-zinc-500">{itens.length} produto(s)</span>}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder='Ex: "bacia", "papel A4", "tinta guache"... (ou use os filtros)'
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          autoFocus
        />
        <Button variant={mostrarFiltros || temFiltro ? 'secondary' : 'outline'} onClick={() => setMostrarFiltros((v) => !v)}>
          <SlidersHorizontal className="h-4 w-4" /> Filtros
        </Button>
        <Button onClick={buscar} disabled={carregando || (!termo.trim() && !temFiltro)}>
          {carregando ? <Spinner /> : <Search className="h-4 w-4" />} Buscar
        </Button>
      </div>

      {mostrarFiltros && (
        <Card>
          <div className="grid gap-3 md:grid-cols-3">
            <Campo rotulo="Fornecedor">
              <Select value={filtros.fornecedor} onChange={(e) => setFiltros({ ...filtros, fornecedor: e.target.value })}>
                <option value="">todos</option>
                {opcoes.fornecedores.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </Select>
            </Campo>
            <Campo rotulo="Escola / Órgão">
              <Select value={filtros.orgao} onChange={(e) => setFiltros({ ...filtros, orgao: e.target.value })}>
                <option value="">todas</option>
                {opcoes.orgaos.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Campo>
            <Campo rotulo="Categoria">
              <Select value={filtros.categoria} onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}>
                <option value="">todas</option>
                {opcoes.categorias.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Campo>
            <Campo rotulo="De (data)">
              <Input type="date" value={filtros.de} onChange={(e) => setFiltros({ ...filtros, de: e.target.value })} />
            </Campo>
            <Campo rotulo="Até (data)">
              <Input type="date" value={filtros.ate} onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })} />
            </Campo>
            <div className="flex items-end">
              <Button variant="ghost" onClick={limpar}>
                <X className="h-4 w-4" /> Limpar filtros
              </Button>
            </div>
          </div>
        </Card>
      )}

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      {descricao && itens && (
        <p className="text-xs text-zinc-500">Resultados para {descricao}</p>
      )}

      {itens && itens.length === 0 && !carregando && (
        <Empty>Nada encontrado. Tente outro termo/filtro, ou pergunte na aba <strong>Perguntar (IA)</strong>.</Empty>
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

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600">{rotulo}</label>
      {children}
    </div>
  )
}
