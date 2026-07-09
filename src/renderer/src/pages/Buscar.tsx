import { useState } from 'react'
import { Search } from 'lucide-react'
import type { HistoricoItem, ResultadoBusca, Sugestao } from '../../../shared/types'
import { fmtPct } from '../lib/format'
import { Alerta, Button, Card, Empty, Input, Spinner } from '../components/ui'
import { HistoricoView } from '../components/HistoricoView'

export function Buscar() {
  const [termo, setTermo] = useState('')
  const [termoBuscado, setTermoBuscado] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null)
  const [historico, setHistorico] = useState<HistoricoItem | null>(null)
  const [aliasSalvo, setAliasSalvo] = useState(false)
  const [escolhaManual, setEscolhaManual] = useState(false)

  async function buscar() {
    const t = termo.trim()
    if (!t) return
    setCarregando(true)
    setErro(null)
    setResultado(null)
    setHistorico(null)
    setAliasSalvo(false)
    setEscolhaManual(false)
    setTermoBuscado(t)

    const res = await window.api.buscar(t)
    if (!res.ok) {
      setErro(res.error)
      setCarregando(false)
      return
    }
    setResultado(res.data)
    if (res.data.resolvido) await carregarHistorico(res.data.resolvido.itemId, false)
    setCarregando(false)
  }

  async function carregarHistorico(itemId: number, manual: boolean) {
    const res = await window.api.historicoItem(itemId)
    if (!res.ok) {
      setErro(res.error)
      return
    }
    setEscolhaManual(manual)
    setAliasSalvo(false)
    setHistorico(res.data)
  }

  async function salvarApelido() {
    if (!historico) return
    const res = await window.api.adicionarAlias(historico.item.id, termoBuscado)
    if (res.ok) setAliasSalvo(true)
    else setErro(res.error)
  }

  const candidatos: Sugestao[] = resultado?.candidatos ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Buscar histórico de preço</h1>

      <div className="flex gap-2">
        <Input
          placeholder='Ex: "Chamex", "papel sulfite A4", "lápis faber castell"...'
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

      {resultado && !historico && candidatos.length > 0 && (
        <Card title="Você quis dizer...">
          <div className="flex flex-wrap gap-2">
            {candidatos.map((c) => (
              <Button key={c.itemId} variant="outline" size="sm" onClick={() => carregarHistorico(c.itemId, true)}>
                {c.itemNome} <span className="text-zinc-400">({fmtPct(c.similaridade)})</span>
              </Button>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Ao escolher, você pode salvar “{termoBuscado}” como apelido para a próxima busca já acertar direto.
          </p>
        </Card>
      )}

      {resultado && !historico && candidatos.length === 0 && !carregando && (
        <Empty>
          Nada encontrado para “{termoBuscado}”. Tente outro termo, ou pergunte na aba{' '}
          <strong>Perguntar (IA)</strong>.
        </Empty>
      )}

      {historico && (
        <div className="space-y-3">
          {escolhaManual && !aliasSalvo && (
            <Alerta tipo="aviso">
              <span className="mr-3">
                Quer que “{termoBuscado}” passe a apontar direto para <strong>{historico.item.nome}</strong>?
              </span>
              <Button size="sm" variant="secondary" onClick={salvarApelido}>
                Salvar apelido
              </Button>
            </Alerta>
          )}
          {aliasSalvo && <Alerta tipo="ok">Apelido salvo — a próxima busca por “{termoBuscado}” resolve direto.</Alerta>}
          <HistoricoView historico={historico} />
        </div>
      )}
    </div>
  )
}
