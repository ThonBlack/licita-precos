import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { ItemComAliases } from '../../../shared/types'
import { Alerta, Badge, Button, Card, Empty, Input, cn } from '../components/ui'

export function Catalogo() {
  const [itens, setItens] = useState<ItemComAliases[]>([])
  const [filtro, setFiltro] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState({ nome: '', categoria: '', unidade: '' })
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    void carregar()
  }, [])

  async function carregar() {
    const res = await window.api.listarCatalogo()
    if (res.ok) setItens(res.data)
    else setErro(res.error)
  }

  const filtrados = useMemo(() => {
    const f = filtro.trim().toLowerCase()
    if (!f) return itens
    return itens.filter(
      (i) =>
        i.nome.toLowerCase().includes(f) ||
        (i.categoria ?? '').toLowerCase().includes(f) ||
        i.aliases.some((a) => a.alias.toLowerCase().includes(f))
    )
  }, [itens, filtro])

  async function criar() {
    if (!novo.nome.trim()) return
    const res = await window.api.criarItem({
      nome: novo.nome,
      categoria: novo.categoria || null,
      unidade: novo.unidade || null
    })
    if (!res.ok) {
      setErro(res.error)
      return
    }
    setNovo({ nome: '', categoria: '', unidade: '' })
    setCriando(false)
    void carregar()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Catálogo de itens</h1>
        <Button onClick={() => setCriando(!criando)} variant={criando ? 'secondary' : 'default'}>
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      {criando && (
        <Card title="Novo item canônico">
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-72"
              placeholder="Nome (ex: Papel Sulfite A4)"
              value={novo.nome}
              onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
              autoFocus
            />
            <Input
              className="w-40"
              placeholder="Categoria (ex: papelaria)"
              value={novo.categoria}
              onChange={(e) => setNovo({ ...novo, categoria: e.target.value })}
            />
            <Input
              className="w-32"
              placeholder="Unidade (ex: Pacote)"
              value={novo.unidade}
              onChange={(e) => setNovo({ ...novo, unidade: e.target.value })}
            />
            <Button onClick={criar} disabled={!novo.nome.trim()}>
              Criar
            </Button>
          </div>
        </Card>
      )}

      <Input
        placeholder="Filtrar por nome, categoria ou apelido..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
      />

      {filtrados.length === 0 ? (
        <Empty>
          {itens.length === 0
            ? 'Catálogo vazio — os itens vão sendo criados conforme você importa mapas.'
            : 'Nada encontrado com esse filtro.'}
        </Empty>
      ) : (
        <div className="space-y-3">
          {filtrados.map((item) => (
            <ItemCard key={item.id} item={item} onMudou={carregar} onErro={setErro} />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemCard({
  item,
  onMudou,
  onErro
}: {
  item: ItemComAliases
  onMudou: () => Promise<void>
  onErro: (e: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [dados, setDados] = useState({
    nome: item.nome,
    categoria: item.categoria ?? '',
    unidade: item.unidade_padrao ?? ''
  })
  const [novoAlias, setNovoAlias] = useState('')

  async function salvarEdicao() {
    const res = await window.api.atualizarItem(item.id, {
      nome: dados.nome,
      categoria: dados.categoria || null,
      unidade: dados.unidade || null
    })
    if (!res.ok) {
      onErro(res.error)
      return
    }
    setEditando(false)
    await onMudou()
  }

  async function excluir() {
    if (
      !confirm(
        `Excluir "${item.nome}"? As ${item.totalOfertas} oferta(s) ligadas a ele ficam sem item (não são apagadas).`
      )
    )
      return
    const res = await window.api.excluirItem(item.id)
    if (!res.ok) onErro(res.error)
    await onMudou()
  }

  async function addAlias() {
    const alias = novoAlias.trim()
    if (!alias) return
    const res = await window.api.adicionarAlias(item.id, alias)
    if (!res.ok) {
      onErro(res.error)
      return
    }
    setNovoAlias('')
    await onMudou()
  }

  async function removerAlias(aliasId: number) {
    const res = await window.api.removerAlias(aliasId)
    if (!res.ok) onErro(res.error)
    await onMudou()
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        {editando ? (
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-64"
              value={dados.nome}
              onChange={(e) => setDados({ ...dados, nome: e.target.value })}
            />
            <Input
              className="w-36"
              placeholder="Categoria"
              value={dados.categoria}
              onChange={(e) => setDados({ ...dados, categoria: e.target.value })}
            />
            <Input
              className="w-28"
              placeholder="Unidade"
              value={dados.unidade}
              onChange={(e) => setDados({ ...dados, unidade: e.target.value })}
            />
            <Button size="icon" variant="secondary" onClick={salvarEdicao} title="Salvar">
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setEditando(false)} title="Cancelar">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div>
            <p className="font-semibold">{item.nome}</p>
            <p className="text-xs text-zinc-500">
              {[item.categoria, item.unidade_padrao].filter(Boolean).join(' · ') || 'sem categoria'} ·{' '}
              {item.totalOfertas} oferta(s)
            </p>
          </div>
        )}
        {!editando && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => setEditando(true)} title="Editar">
              <Pencil className="h-4 w-4 text-zinc-400" />
            </Button>
            <Button size="icon" variant="ghost" onClick={excluir} title="Excluir">
              <Trash2 className="h-4 w-4 text-zinc-400 hover:text-red-500" />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {item.aliases.map((a) => (
          <Badge key={a.id} tone={a.origem === 'confirmado_usuario' ? 'blue' : 'gray'} className="group">
            {a.alias}
            <button
              onClick={() => removerAlias(a.id)}
              title="Remover apelido"
              className={cn('ml-0.5 rounded-full hover:text-red-600')}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            className="h-7 w-44 text-xs"
            placeholder="novo apelido/marca..."
            value={novoAlias}
            onChange={(e) => setNovoAlias(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAlias()}
          />
          {novoAlias.trim() && (
            <Button size="sm" variant="secondary" onClick={addAlias}>
              adicionar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
