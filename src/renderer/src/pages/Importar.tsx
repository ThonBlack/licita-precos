import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Paperclip,
  RefreshCw,
  Sparkles,
  Trash2
} from 'lucide-react'
import { montarPromptAntigravity } from '../../../shared/prompts'
import type {
  DecisaoLinha,
  ImportacaoParseada,
  ItemComAliases,
  LinhaImportacao,
  Mapa,
  ResumoImportacao,
  SessaoMapa,
  StatusSync,
  Sugestao
} from '../../../shared/types'
import { fmtBRL, fmtData, fmtNum, fmtPct } from '../lib/format'
import { Alerta, Badge, Button, Card, Empty, Input, Select, Spinner, Textarea, cn } from '../components/ui'

type Decisoes = Record<number, DecisaoLinha>

function decisaoInicial(l: LinhaImportacao): DecisaoLinha {
  if ((l.match.tipo === 'exato' || l.match.tipo === 'forte') && l.match.itemId != null) {
    return { linha: l.linha, acao: 'associar', itemId: l.match.itemId, salvarAlias: l.match.tipo !== 'exato' }
  }
  return { linha: l.linha, acao: 'pendente', salvarAlias: true }
}

export function Importar() {
  const [parseada, setParseada] = useState<ImportacaoParseada | null>(null)
  const [decisoes, setDecisoes] = useState<Decisoes>({})
  const [catalogo, setCatalogo] = useState<ItemComAliases[]>([])
  const [meta, setMeta] = useState({ idCompra: '', orgao: '', dataAutenticacao: '' })
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null)
  const [mapas, setMapas] = useState<Mapa[]>([])
  const [copiado, setCopiado] = useState(false)
  const [sync, setSync] = useState<StatusSync | null>(null)
  const [agInstalado, setAgInstalado] = useState<boolean | null>(null)
  const [importandoSync, setImportandoSync] = useState(false)
  const [sessao, setSessao] = useState<SessaoMapa | null>(null)
  const [preparando, setPreparando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)

  async function copiarPromptAntigravity() {
    await navigator.clipboard.writeText(
      montarPromptAntigravity(sessao?.caminhoXlsx ?? '', sessao?.caminhosMapas ?? [])
    )
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function prepararMapa() {
    setPreparando(true)
    setErro(null)
    setResumo(null)
    const res = await window.api.prepararMapa()
    setPreparando(false)
    if (!res.ok) {
      setErro(res.error)
      return
    }
    setSessao(res.data)
    setAviso('Planilha criada. Agora adicione as fotos/PDFs e cole o prompt no Antigravity.')
  }

  async function adicionarArquivos() {
    if (!sessao) return
    setErro(null)
    const res = await window.api.adicionarArquivosMapa(sessao.pastaSessao)
    if (!res.ok) {
      setErro(res.error)
      return
    }
    setSessao({ ...sessao, caminhosMapas: res.data })
  }

  async function importarDaSessao() {
    if (!sessao) return
    setErro(null)
    setAviso(null)
    setResumo(null)
    setCarregando(true)
    const res = await window.api.importarSessao(sessao.caminhoXlsx)
    setCarregando(false)
    if (!res.ok) {
      setErro(res.error)
      return
    }
    const cat = await window.api.listarCatalogo()
    if (cat.ok) setCatalogo(cat.data)
    setParseada(res.data)
    setMeta({ idCompra: '', orgao: '', dataAutenticacao: '' })
    const iniciais: Decisoes = {}
    for (const l of res.data.linhas) iniciais[l.linha] = decisaoInicial(l)
    setDecisoes(iniciais)
  }

  async function sincronizar() {
    setSincronizando(true)
    setErro(null)
    const res = await window.api.sincronizar()
    setSincronizando(false)
    if (!res.ok) {
      setErro(res.error)
      return
    }
    const r = res.data
    setAviso(
      `Sincronizado: ${r.enviados} enviado(s), ${r.mapasImportados} recebido(s)` +
        (r.falhas ? `, ${r.falhas} com erro` : '') +
        '.'
    )
    await carregarMapas()
    await carregarSync()
  }

  async function abrirAntigravity() {
    const res = await window.api.abrirAntigravity()
    if (res.ok) setAgInstalado(res.data.instalado)
  }

  useEffect(() => {
    void carregarMapas()
    void carregarSync()
    void window.api.statusAntigravity().then((r) => {
      if (r.ok) setAgInstalado(r.data.instalado)
    })
  }, [])

  async function carregarMapas() {
    const res = await window.api.listarMapas()
    if (res.ok) setMapas(res.data)
  }

  async function carregarSync() {
    const res = await window.api.statusSync()
    if (res.ok) setSync(res.data)
  }

  async function adicionarDaSync() {
    setImportandoSync(true)
    setErro(null)
    const res = await window.api.importarSync()
    setImportandoSync(false)
    if (!res.ok) {
      setErro(res.error)
      return
    }
    const r = res.data
    setAviso(
      `${r.mapasImportados} mapa(s) de outros PCs adicionados: ${r.ofertasCriadas} ofertas, ` +
        `${r.itensCriados} item(ns) novo(s)${r.falhas ? `, ${r.falhas} com erro` : ''}.`
    )
    await carregarMapas()
    await carregarSync()
  }

  async function baixarTemplate() {
    setErro(null)
    const res = await window.api.baixarTemplate()
    if (!res.ok) setErro(res.error)
    else if (res.data) setAviso(`Modelo salvo em: ${res.data.caminho}`)
  }

  async function abrirPlanilha() {
    setErro(null)
    setAviso(null)
    setResumo(null)
    setCarregando(true)
    const res = await window.api.abrirImportacao()
    setCarregando(false)
    if (!res.ok) {
      setErro(res.error)
      return
    }
    if (!res.data) return // cancelado
    const cat = await window.api.listarCatalogo()
    if (cat.ok) setCatalogo(cat.data)
    setParseada(res.data)
    setMeta({ idCompra: '', orgao: '', dataAutenticacao: '' })
    const iniciais: Decisoes = {}
    for (const l of res.data.linhas) iniciais[l.linha] = decisaoInicial(l)
    setDecisoes(iniciais)
  }

  function atualizarDecisao(linha: number, patch: Partial<DecisaoLinha>) {
    setDecisoes((d) => ({ ...d, [linha]: { ...d[linha]!, ...patch } }))
  }

  const pendentes = useMemo(
    () => Object.values(decisoes).filter((d) => d.acao === 'pendente').length,
    [decisoes]
  )

  async function salvar() {
    if (!parseada) return
    setCarregando(true)
    setErro(null)
    const res = await window.api.confirmarImportacao(
      {
        arquivo: parseada.arquivo,
        idCompra: meta.idCompra || null,
        orgao: meta.orgao || null,
        dataAutenticacao: meta.dataAutenticacao || null
      },
      parseada.linhas,
      Object.values(decisoes)
    )
    setCarregando(false)
    if (!res.ok) {
      setErro(res.error)
      return
    }
    setResumo(res.data)
    setParseada(null)
    setDecisoes({})
    setSessao(null)
    void carregarMapas()
    void carregarSync()
  }

  async function excluirMapa(m: Mapa) {
    if (!confirm(`Excluir o mapa "${m.origem_arquivo ?? m.id}" e suas ${m.totalOfertas} ofertas?`)) return
    const res = await window.api.excluirMapa(m.id)
    if (!res.ok) setErro(res.error)
    void carregarMapas()
  }

  // -------------------------------------------------------------------------

  if (parseada) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Revisar importação</h1>
            <p className="text-sm text-zinc-500">{parseada.arquivo} · {parseada.linhas.length} itens</p>
          </div>
          <Button variant="ghost" onClick={() => setParseada(null)}>
            Cancelar
          </Button>
        </div>

        {parseada.avisos.length > 0 && (
          <Alerta tipo="aviso">
            {parseada.avisos.slice(0, 5).map((a, i) => (
              <div key={i}>{a}</div>
            ))}
            {parseada.avisos.length > 5 && <div>… e mais {parseada.avisos.length - 5} aviso(s).</div>}
          </Alerta>
        )}

        <Card title="Dados do mapa">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Órgão / Escola</label>
              <Input
                placeholder="Ex: E.E. América"
                value={meta.orgao}
                onChange={(e) => setMeta({ ...meta, orgao: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">ID da compra</label>
              <Input
                placeholder="Ex: 2026.134827"
                value={meta.idCompra}
                onChange={(e) => setMeta({ ...meta, idCompra: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Data de autenticação</label>
              <Input
                type="date"
                value={meta.dataAutenticacao}
                onChange={(e) => setMeta({ ...meta, dataAutenticacao: e.target.value })}
              />
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          {parseada.linhas.map((l) => (
            <LinhaRevisao
              key={l.linha}
              linha={l}
              decisao={decisoes[l.linha]!}
              catalogo={catalogo}
              onChange={(patch) => atualizarDecisao(l.linha, patch)}
            />
          ))}
        </div>

        {erro && <Alerta tipo="erro">{erro}</Alerta>}

        <div className="sticky bottom-0 flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3 shadow">
          <p className="text-sm text-zinc-600">
            {pendentes > 0 ? (
              <>
                <Badge tone="yellow">{pendentes} pendente(s)</Badge>{' '}
                <span className="ml-1">ofertas pendentes entram sem item — dá pra resolver depois no Catálogo.</span>
              </>
            ) : (
              <Badge tone="green">todas as linhas resolvidas</Badge>
            )}
          </p>
          <Button onClick={salvar} disabled={carregando}>
            {carregando && <Spinner />} Salvar mapa
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Importar mapa de apuração</h1>
        {sync?.pastaConfigurada && (
          <Button variant="outline" size="sm" onClick={sincronizar} disabled={sincronizando}>
            {sincronizando ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Sincronizar
          </Button>
        )}
      </div>

      {resumo && (
        <Alerta tipo="ok">
          Mapa #{resumo.mapaId} salvo: {resumo.ofertasCriadas} ofertas, {resumo.itensCriados} item(ns) novo(s),{' '}
          {resumo.aliasesCriados} apelido(s) aprendido(s)
          {resumo.linhasPendentes > 0 && `, ${resumo.linhasPendentes} linha(s) pendente(s)`}
          {resumo.linhasPuladas > 0 && `, ${resumo.linhasPuladas} pulada(s)`}.
        </Alerta>
      )}
      {aviso && <Alerta tipo="ok">{aviso}</Alerta>}
      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      {sync && sync.pendentes.length > 0 && (
        <Card
          title={
            <span className="inline-flex items-center gap-1.5">
              <Cloud className="h-4 w-4 text-sky-500" /> Mapas de outros PCs
            </span>
          }
          actions={
            <Button size="sm" onClick={adicionarDaSync} disabled={importandoSync}>
              {importandoSync ? <Spinner /> : <Download className="h-4 w-4" />} Adicionar {sync.pendentes.length}
            </Button>
          }
        >
          <p className="mb-2 text-sm text-zinc-600">
            {sync.pendentes.length} mapa(s) importados em outro PC estão na pasta compartilhada. Adicione-os
            ao seu histórico (o reconhecimento de itens é refeito com o seu catálogo).
          </p>
          <ul className="space-y-1 text-sm text-zinc-700">
            {sync.pendentes.slice(0, 6).map((p) => (
              <li key={p.uuid} className="flex items-center gap-2">
                <Badge tone="blue">{p.totalItens} itens</Badge>
                <span className="truncate">
                  {p.orgao ?? p.origemArquivo ?? p.uuid.slice(0, 8)}
                  {p.dataAutenticacao && <span className="text-zinc-400"> · {fmtData(p.dataAutenticacao)}</span>}
                </span>
              </li>
            ))}
            {sync.pendentes.length > 6 && <li className="text-zinc-400">… e mais {sync.pendentes.length - 6}.</li>}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="1 · Baixar modelo">
          <p className="mb-3 text-sm text-zinc-600">
            Gere a planilha modelo e preencha com os dados do mapa. Para mapas em foto/PDF escaneado, use o
            prompt que está na aba “Instruções” do modelo com o Claude ou ChatGPT.
          </p>
          <Button variant="outline" onClick={baixarTemplate}>
            <Download className="h-4 w-4" /> Baixar modelo de planilha
          </Button>
        </Card>

        <Card title="2 · Importar planilha preenchida">
          <p className="mb-3 text-sm text-zinc-600">
            O sistema tenta reconhecer cada item automaticamente. O que não bater, você confirma uma vez — e
            ele aprende para a próxima.
          </p>
          <Button onClick={abrirPlanilha} disabled={carregando}>
            {carregando ? <Spinner /> : <FileSpreadsheet className="h-4 w-4" />} Selecionar planilha
          </Button>
        </Card>
      </div>

      <Card
        title={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-violet-500" /> Preencher com IA (Antigravity)
          </span>
        }
      >
        {!sessao ? (
          <>
            <p className="mb-3 text-sm text-zinc-600">
              Jeito automático: o app cria a planilha e junta as fotos/PDFs numa pasta, já monta o
              prompt com os <strong>caminhos certos</strong>, você cola no <strong>Antigravity</strong>{' '}
              e ele preenche sozinho. Depois é só importar.
            </p>
            <Button onClick={prepararMapa} disabled={preparando}>
              {preparando ? <Spinner /> : <Sparkles className="h-4 w-4" />} Preparar mapa para IA
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-600">
              <li>
                Adicione os arquivos do mapa — foto, PDF, Word, .txt, planilha{' '}
                <span className="text-zinc-400">(pode marcar vários)</span>.
              </li>
              <li>Copie o prompt e abra o Antigravity — cole lá e mande rodar.</li>
              <li>Quando ele terminar, clique em “Já preenchi — importar”.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={adicionarArquivos}>
                <Paperclip className="h-4 w-4" /> Adicionar arquivos ({sessao.caminhosMapas.length})
              </Button>
              <Button size="sm" variant="outline" onClick={copiarPromptAntigravity}>
                {copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copiado ? 'Copiado!' : 'Copiar prompt'}
              </Button>
              <Button size="sm" variant="ghost" onClick={abrirAntigravity}>
                {agInstalado ? <ExternalLink className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {agInstalado === false ? 'Baixar Antigravity' : 'Abrir Antigravity'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSessao(null)}>
                Cancelar
              </Button>
            </div>
            <p className="break-all text-xs text-zinc-500">
              Planilha: <span className="font-mono">{sessao.caminhoXlsx}</span>
            </p>
            <Textarea
              readOnly
              rows={9}
              value={montarPromptAntigravity(sessao.caminhoXlsx, sessao.caminhosMapas)}
              onFocus={(e) => e.currentTarget.select()}
              className="resize-none font-mono text-xs text-zinc-700"
            />
            <div className="flex justify-end">
              <Button onClick={importarDaSessao} disabled={carregando}>
                {carregando ? <Spinner /> : <FileSpreadsheet className="h-4 w-4" />} Já preenchi — importar
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Mapas importados">
        {mapas.length === 0 ? (
          <Empty>Nenhum mapa importado ainda.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3">Arquivo</th>
                <th className="py-2 pr-3">Órgão</th>
                <th className="py-2 pr-3">ID compra</th>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3 text-right">Ofertas</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {mapas.map((m) => (
                <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                  <td className="max-w-52 truncate py-2 pr-3" title={m.origem_arquivo ?? undefined}>
                    {m.origem_arquivo ?? '—'}
                  </td>
                  <td className="max-w-44 truncate py-2 pr-3">{m.orgao ?? '—'}</td>
                  <td className="py-2 pr-3">{m.id_compra ?? '—'}</td>
                  <td className="py-2 pr-3">{fmtData(m.data_autenticacao)}</td>
                  <td className="py-2 pr-3 text-right">{m.totalOfertas}</td>
                  <td className="py-2 text-right">
                    <Button variant="ghost" size="icon" title="Excluir mapa" onClick={() => excluirMapa(m)}>
                      <Trash2 className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------

function LinhaRevisao({
  linha,
  decisao,
  catalogo,
  onChange
}: {
  linha: LinhaImportacao
  decisao: DecisaoLinha
  catalogo: ItemComAliases[]
  onChange: (patch: Partial<DecisaoLinha>) => void
}) {
  const menorValor = Math.min(
    ...linha.propostas.filter((p) => p.valorUnitario != null).map((p) => p.valorUnitario!)
  )
  const itemAssociado = decisao.itemId != null ? catalogo.find((c) => c.id === decisao.itemId) : undefined
  const nomeAssociado =
    itemAssociado?.nome ?? (decisao.itemId === linha.match.itemId ? linha.match.itemNome : null)

  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-3 shadow-sm',
        decisao.acao === 'associar' && 'border-emerald-200',
        decisao.acao === 'criar' && 'border-blue-200',
        decisao.acao === 'pendente' && 'border-amber-300',
        decisao.acao === 'pular' && 'border-zinc-200 opacity-60'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {linha.numeroItem && <span className="mr-1 text-zinc-400">#{linha.numeroItem}</span>}
            {linha.descricao}
          </p>
          <p className="text-xs text-zinc-500">
            {fmtNum(linha.quantidade)} {linha.unidade ?? ''} · {linha.propostas.length} proposta(s) · menor:{' '}
            {fmtBRL(Number.isFinite(menorValor) ? menorValor : null)}
          </p>
        </div>
        <StatusLinha decisao={decisao} nomeItem={nomeAssociado} match={linha.match.tipo} sim={linha.match.similaridade} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select
          value={decisao.acao}
          onChange={(e) => {
            const acao = e.target.value as DecisaoLinha['acao']
            if (acao === 'criar') {
              onChange({
                acao,
                itemId: undefined,
                novoItem: decisao.novoItem ?? {
                  nome: linha.descricao,
                  categoria: null,
                  unidade: linha.unidade
                }
              })
            } else {
              onChange({ acao })
            }
          }}
        >
          <option value="associar">Associar a item existente</option>
          <option value="criar">Criar item novo</option>
          <option value="pendente">Deixar pendente</option>
          <option value="pular">Pular linha</option>
        </Select>

        {decisao.acao === 'associar' && (
          <>
            <SeletorItem
              catalogo={catalogo}
              valorAtual={nomeAssociado}
              onSelect={(id) => onChange({ itemId: id })}
            />
            {linha.match.sugestoes
              .filter((s) => s.itemId !== decisao.itemId)
              .slice(0, 3)
              .map((s: Sugestao) => (
                <Button key={s.itemId} size="sm" variant="outline" onClick={() => onChange({ itemId: s.itemId })}>
                  → {s.itemNome} ({fmtPct(s.similaridade)})
                </Button>
              ))}
          </>
        )}

        {decisao.acao === 'criar' && decisao.novoItem && (
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-72"
              placeholder="Nome do item canônico"
              value={decisao.novoItem.nome}
              onChange={(e) => onChange({ novoItem: { ...decisao.novoItem!, nome: e.target.value } })}
            />
            <Input
              className="w-32"
              placeholder="Categoria"
              value={decisao.novoItem.categoria ?? ''}
              onChange={(e) =>
                onChange({ novoItem: { ...decisao.novoItem!, categoria: e.target.value || null } })
              }
            />
            <Input
              className="w-28"
              placeholder="Unidade"
              value={decisao.novoItem.unidade ?? ''}
              onChange={(e) =>
                onChange({ novoItem: { ...decisao.novoItem!, unidade: e.target.value || null } })
              }
            />
          </div>
        )}

        {(decisao.acao === 'associar' || decisao.acao === 'criar') && (
          <label className="flex items-center gap-1.5 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={decisao.salvarAlias}
              onChange={(e) => onChange({ salvarAlias: e.target.checked })}
            />
            aprender esta descrição como apelido
          </label>
        )}
      </div>
    </div>
  )
}

function StatusLinha({
  decisao,
  nomeItem,
  match,
  sim
}: {
  decisao: DecisaoLinha
  nomeItem: string | null | undefined
  match: LinhaImportacao['match']['tipo']
  sim: number
}) {
  if (decisao.acao === 'pular') return <Badge tone="gray">vai ser pulada</Badge>
  if (decisao.acao === 'pendente') return <Badge tone="yellow">pendente</Badge>
  if (decisao.acao === 'criar') return <Badge tone="blue">novo: {decisao.novoItem?.nome || '...'}</Badge>
  if (decisao.itemId == null) return <Badge tone="yellow">escolha o item</Badge>
  return (
    <Badge tone="green">
      → {nomeItem ?? `item #${decisao.itemId}`}
      {match !== 'exato' && sim > 0 && ` (${fmtPct(sim)})`}
    </Badge>
  )
}

function SeletorItem({
  catalogo,
  valorAtual,
  onSelect
}: {
  catalogo: ItemComAliases[]
  valorAtual: string | null | undefined
  onSelect: (id: number) => void
}) {
  const [filtro, setFiltro] = useState('')
  const [aberto, setAberto] = useState(false)

  const filtrados = useMemo(() => {
    const f = filtro.trim().toLowerCase()
    if (!f) return catalogo.slice(0, 8)
    return catalogo
      .filter(
        (c) =>
          c.nome.toLowerCase().includes(f) || c.aliases.some((a) => a.alias.toLowerCase().includes(f))
      )
      .slice(0, 8)
  }, [catalogo, filtro])

  return (
    <div className="relative">
      <Input
        className="w-64"
        placeholder={valorAtual ?? 'digite para buscar item...'}
        value={filtro}
        onChange={(e) => {
          setFiltro(e.target.value)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
      />
      {aberto && filtrados.length > 0 && (
        <div className="absolute z-10 mt-1 w-72 rounded-md border border-zinc-200 bg-white shadow-lg">
          {filtrados.map((c) => (
            <button
              key={c.id}
              className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-zinc-100"
              onMouseDown={() => {
                onSelect(c.id)
                setFiltro('')
                setAberto(false)
              }}
            >
              {c.nome}
              {c.categoria && <span className="ml-1 text-xs text-zinc-400">· {c.categoria}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
