import { useEffect, useState } from 'react'
import { ArrowRight, Trophy } from 'lucide-react'
import type { Fornecedor } from '../../../shared/types'
import { fmtBRL, fmtPct } from '../lib/format'
import { Alerta, Badge, Button, Card, Empty, Input, Spinner } from '../components/ui'

export function Fornecedores({ irParaProdutos }: { irParaProdutos?: (fornecedor: string) => void }) {
  const [lista, setLista] = useState<Fornecedor[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    void window.api.listarFornecedores().then((r) => (r.ok ? setLista(r.data) : setErro(r.error)))
  }, [])

  if (erro) return <Alerta tipo="erro">{erro}</Alerta>
  if (!lista) return <Spinner />

  const f = filtro.trim().toLowerCase()
  const filtrados = f ? lista.filter((x) => x.nome.toLowerCase().includes(f)) : lista

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Fornecedores</h1>
        <span className="text-sm text-zinc-500">{lista.length} concorrente(s)</span>
      </div>
      <p className="text-sm text-zinc-600">
        Quem disputa e quem ganha. <strong>Taxa de vitória</strong> alta = concorrente forte no preço.
        Clique em “ver produtos” para ver tudo que ele cotou.
      </p>

      <Input placeholder="Filtrar fornecedor..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />

      <Card>
        {filtrados.length === 0 ? (
          <Empty>Nenhum fornecedor.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Fornecedor</th>
                  <th className="py-2 pr-3 text-right">Lances</th>
                  <th className="py-2 pr-3 text-right">Vitórias</th>
                  <th className="py-2 pr-3 text-right">Taxa</th>
                  <th className="py-2 pr-3 text-right">Itens</th>
                  <th className="py-2 pr-3 text-right">Ticket médio</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((x) => (
                  <tr key={x.nome} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                    <td className="max-w-64 truncate py-2 pr-3 font-medium" title={x.nome}>
                      {x.vitorias > 0 && <Trophy className="mr-1 inline h-3.5 w-3.5 text-amber-500" />}
                      {x.nome}
                    </td>
                    <td className="py-2 pr-3 text-right">{x.ofertas}</td>
                    <td className="py-2 pr-3 text-right">{x.vitorias}</td>
                    <td className="py-2 pr-3 text-right">
                      <Badge tone={x.taxaVitoria >= 0.5 ? 'green' : x.taxaVitoria > 0 ? 'yellow' : 'gray'}>
                        {fmtPct(x.taxaVitoria)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-right">{x.itens}</td>
                    <td className="py-2 pr-3 text-right">{fmtBRL(x.ticketMedio)}</td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => irParaProdutos?.(x.nome)}>
                        ver produtos <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
