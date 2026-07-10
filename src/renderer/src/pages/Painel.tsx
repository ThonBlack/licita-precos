import { useEffect, useState } from 'react'
import type { ResumoPainel } from '../../../shared/types'
import { fmtBRL, fmtData } from '../lib/format'
import { Alerta, Card, Empty, Spinner, StatCard } from '../components/ui'

export function Painel({ irParaProduto }: { irParaProduto?: (nome: string) => void }) {
  const [r, setR] = useState<ResumoPainel | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    void window.api.painelResumo().then((res) => (res.ok ? setR(res.data) : setErro(res.error)))
  }, [])

  if (erro) return <Alerta tipo="erro">{erro}</Alerta>
  if (!r) return <Spinner />

  const maxGasto = Math.max(1, ...r.gastoPorOrgao.map((g) => g.total))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Painel</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard rotulo="Mapas" valor={String(r.totais.mapas)} />
        <StatCard rotulo="Itens no catálogo" valor={String(r.totais.itens)} />
        <StatCard rotulo="Lances (ofertas)" valor={String(r.totais.ofertas)} />
        <StatCard rotulo="Fornecedores" valor={String(r.totais.fornecedores)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Gasto estimado por escola">
          {r.gastoPorOrgao.length === 0 ? (
            <Empty>Sem dados ainda.</Empty>
          ) : (
            <div className="space-y-2">
              {r.gastoPorOrgao.map((g) => (
                <div key={g.orgao}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="truncate pr-2" title={g.orgao}>{g.orgao}</span>
                    <span className="shrink-0 font-semibold">{fmtBRL(g.total)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100">
                    <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${(g.total / maxGasto) * 100}%` }} />
                  </div>
                </div>
              ))}
              <p className="pt-1 text-xs text-zinc-400">Soma dos itens vencedores de cada mapa.</p>
            </div>
          )}
        </Card>

        <Card title="Itens mais caros (maior preço unitário visto)">
          {r.topItens.length === 0 ? (
            <Empty>Sem dados ainda.</Empty>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {r.topItens.map((i) => (
                <li key={i.itemId} className="flex items-center justify-between gap-2">
                  <button
                    className="min-w-0 truncate text-left hover:text-zinc-900 hover:underline"
                    title={i.nome}
                    onClick={() => irParaProduto?.(i.nome)}
                  >
                    {i.nome}
                  </button>
                  <span className="shrink-0 font-semibold">{fmtBRL(i.maxUnit)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Últimos mapas importados">
        {r.ultimosMapas.length === 0 ? (
          <Empty>Nenhum mapa ainda.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3">Escola / Órgão</th>
                <th className="py-2 pr-3">ID compra</th>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 text-right">Lances</th>
              </tr>
            </thead>
            <tbody>
              {r.ultimosMapas.map((m) => (
                <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                  <td className="max-w-64 truncate py-2 pr-3" title={m.orgao ?? undefined}>{m.orgao ?? '—'}</td>
                  <td className="py-2 pr-3">{m.idCompra ?? '—'}</td>
                  <td className="py-2 pr-3">{fmtData(m.data)}</td>
                  <td className="py-2 text-right">{m.ofertas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
