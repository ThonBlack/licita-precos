import { useEffect, useState } from 'react'
import { FileUp, Library, MessageCircle, Search, Settings } from 'lucide-react'
import { cn } from './components/ui'
import { Buscar } from './pages/Buscar'
import { Perguntar } from './pages/Perguntar'
import { Importar } from './pages/Importar'
import { Catalogo } from './pages/Catalogo'
import { Config } from './pages/Config'

export type Pagina = 'buscar' | 'perguntar' | 'importar' | 'catalogo' | 'config'

const NAV: { id: Pagina; rotulo: string; Icone: typeof Search }[] = [
  { id: 'buscar', rotulo: 'Buscar', Icone: Search },
  { id: 'perguntar', rotulo: 'Perguntar (IA)', Icone: MessageCircle },
  { id: 'importar', rotulo: 'Importar mapa', Icone: FileUp },
  { id: 'catalogo', rotulo: 'Catálogo', Icone: Library },
  { id: 'config', rotulo: 'Configurações', Icone: Settings }
]

export default function App() {
  const [pagina, setPagina] = useState<Pagina>('buscar')
  const [pendentesSync, setPendentesSync] = useState(0)

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
          {pagina === 'buscar' && <Buscar />}
          {pagina === 'perguntar' && <Perguntar irPara={setPagina} />}
          {pagina === 'importar' && <Importar />}
          {pagina === 'catalogo' && <Catalogo />}
          {pagina === 'config' && <Config />}
        </div>
      </main>
    </div>
  )
}
