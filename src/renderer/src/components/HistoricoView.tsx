import type { HistoricoItem } from '../../../shared/types'
import { fmtBRL, fmtData, fmtNum } from '../lib/format'
import { Badge, Empty, StatCard } from './ui'

/** Bloco reutilizável: estatísticas + tabela do histórico de um item. */
export function HistoricoView({ historico }: { historico: HistoricoItem }) {
  const { item, stats, registros } = historico
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{item.nome}</h2>
        <p className="text-sm text-zinc-500">
          {[item.categoria, item.unidade_padrao].filter(Boolean).join(' · ') || 'sem categoria'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard rotulo="Mínimo" valor={fmtBRL(stats.minimo)} />
        <StatCard rotulo="Mediana" valor={fmtBRL(stats.mediana)} />
        <StatCard rotulo="Máximo" valor={fmtBRL(stats.maximo)} />
        <StatCard rotulo="Registros" valor={`${stats.registros} em ${stats.mapas} mapa(s)`} />
      </div>

      {(stats.vencedorFrequente || stats.ultimaData) && (
        <p className="text-sm text-zinc-600">
          {stats.vencedorFrequente && (
            <>
              Vencedor mais frequente: <strong>{stats.vencedorFrequente}</strong>
            </>
          )}
          {stats.vencedorFrequente && stats.ultimaData && ' · '}
          {stats.ultimaData && <>Último registro: {fmtData(stats.ultimaData)}</>}
        </p>
      )}

      {registros.length === 0 ? (
        <Empty>Nenhuma oferta registrada para este item ainda.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Órgão</th>
                <th className="px-3 py-2">Proponente</th>
                <th className="px-3 py-2 text-right">Qtd</th>
                <th className="px-3 py-2 text-right">Valor unit.</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r, i) => (
                <tr key={i} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtData(r.data_autenticacao)}</td>
                  <td className="px-3 py-2 max-w-56 truncate" title={r.orgao ?? undefined}>
                    {r.orgao ?? '—'}
                  </td>
                  <td className="px-3 py-2 max-w-56 truncate" title={r.proponente}>
                    {r.proponente}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {fmtNum(r.quantidade)} {r.unidade ?? ''}
                  </td>
                  <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                    {fmtBRL(r.valor_unitario)}
                  </td>
                  <td className="px-3 py-2">{r.venceu ? <Badge tone="green">venceu</Badge> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
