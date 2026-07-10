import { useEffect, useState } from 'react'
import { FileUp, LayoutDashboard, Library, MessageCircle, Search, Settings, Users } from 'lucide-react'
import { cn } from './components/ui'
import { Tutorial } from './components/Tutorial'
import { Novidades, NOVIDADES_VERSAO } from './components/Novidades'
import { Painel } from './pages/Painel'
import { Buscar } from './pages/Buscar'
import { Perguntar } from './pages/Perguntar'
import { Fornecedores } from './pages/Fornecedores'
import { Importar } from './pages/Importar'
import { Catalogo } from './pages/Catalogo'
import { Config } from './pages/Config'
import type { FiltrosBusca } from '../../shared/types'

export type Pagina = 'painel' | 'buscar' | 'perguntar' | 'fornecedores' | 'importar' | 'catalogo' | 'config'

const NAV: { id: Pagina; rotulo: string; Icone: typeof Search }[] = [
  { id: 'painel', rotulo: 'Painel', Icone: LayoutDashboard },
  { id: 'buscar', rotulo: 'Buscar', Icone: Search },
  { id: 'perguntar', rotulo: 'Perguntar (IA)', Icone: MessageCircle },
  { id: 'fornecedores', rotulo: 'Fornecedores', Icone: Users },
  { id: 'importar', rotulo: 'Importar mapa', Icone: FileUp },
  { id: 'catalogo', rotulo: 'Catálogo', Icone: Library },
  { id: 'config', rotulo: 'Configurações', Icone: Settings }
]

export default function App() {
  const [pagina, setPagina] = useState<Pagina>('painel')
  const [pendentesSync, setPendentesSync] = useState(0)
  const [modal, setModal] = useState<'tutorial' | 'novidades' | null>(null)
  const [filtroProdutos, setFiltroProdutos] = useState<FiltrosBusca | null>(null)

  useEffect(() => {
    void window.api.obterConfig().then((res) => {
      if (!res.ok) return
      if (!res.data.tutorialConcluido) setModal('tutorial')
      else if (res.data.novidadesVersao !== NOVIDADES_VERSAO) setModal('novidades')
    })
  }, [])

  async function fecharTutorial() {
    setModal(null)
    await window.api.salvarConfig({ tutorialConcluido: true, novidadesVersao: NOVIDADES_VERSAO })
  }
  async function fecharNovidades() {
    setModal(null)
    await window.api.salvarConfig({ novidadesVersao: NOVIDADES_VERSAO })
  }

  function verProdutosDoFornecedor(fornecedor: string) {
    setFiltroProdutos({ fornecedor })
    setPagina('buscar')
  }
  function verProduto(nome: string) {
    setFiltroProdutos({ termo: nome })
    setPagina('buscar')
  }

  useEffect(() => {
    let vivo = true
    const checar = async () => {
      const res = await window.api.statusSync()
      if (vivo && res.ok) setPendentesSync(res.data.pendentes.length)
    }
    void checar()
    const t = setInterval(() => void checar(), 30_000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [pagina])

  return (
    <div className="flex h-full">
      {modal === 'tutorial' && <Tutorial onFechar={fecharTutorial} />}
      {modal === 'novidades' && <Novidades onFechar={fecharNovidades} irPara={setPagina} />}
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="px-4 py-5">
          <h1 className="text-lg font-bold tracking-tight">LicitaPreços</h1>
          <p className="text-xs text-zinc-500">Histórico de mapas de apuração</p>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {NAV.map(({ id, rotulo, Icone }) => (
            <button
              key={id}
              onClick={() => setPagina(id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pagina === id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
              )}
            >
              <Icone className="h-4 w-4" />
              {rotulo}
              {id === 'importar' && pendentesSync > 0 && (
                <span
                  className={cn(
                    'ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
                    pagina === id ? 'bg-white text-zinc-900' : 'bg-sky-500 text-white'
                  )}
                  title="mapas de outros PCs prontos para adicionar"
                >
                  {pendentesSync}
                </span>
              )}
            </button>
          ))}
        </nav>
        <p className="px-4 py-3 text-[11px] text-zinc-400">Uso local · dados no seu PC</p>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6">
          {pagina === 'painel' && <Painel irParaProduto={verProduto} />}
          {pagina === 'buscar' && <Buscar filtroInicial={filtroProdutos} />}
          {pagina === 'perguntar' && <Perguntar irPara={setPagina} />}
          {pagina === 'fornecedores' && <Fornecedores irParaProdutos={verProdutosDoFornecedor} />}
          {pagina === 'importar' && <Importar />}
          {pagina === 'catalogo' && <Catalogo />}
          {pagina === 'config' && <Config onAbrirTutorial={() => setModal('tutorial')} />}
        </div>
      </main>
    </div>
  )
}
