import type { ReactNode } from 'react'
import { Combine, FileDown, LayoutDashboard, PartyPopper, Search, Target, Users, X } from 'lucide-react'
import { Button } from './ui'
import type { Pagina } from '../App'

/** Bump quando lançar novidades: se != do que está salvo no config, o modal reaparece. */
export const NOVIDADES_VERSAO = 'v0.4.1'

const ITENS: { Icone: typeof Search; titulo: string; texto: ReactNode }[] = [
  {
    Icone: LayoutDashboard,
    titulo: 'Painel',
    texto: <>Uma tela de abertura com o resumo: gasto por escola, itens mais caros e últimos mapas.</>
  },
  {
    Icone: Search,
    titulo: 'Busca com filtros',
    texto: (
      <>
        Agora a busca mostra <strong>todos</strong> os produtos parecidos (não só um) e você filtra por{' '}
        <strong>fornecedor, escola, categoria e período</strong>.
      </>
    )
  },
  {
    Icone: Target,
    titulo: 'Ajudante de proposta 🎯',
    texto: (
      <>
        Em cada item aparece <strong>“para ganhar, cote até R$X”</strong> — o menor preço já visto e a média dos
        vencedores. Vantagem na hora de precificar.
      </>
    )
  },
  {
    Icone: Users,
    titulo: 'Fornecedores',
    texto: (
      <>
        Veja quem disputa e quem ganha: <strong>taxa de vitória</strong>, quantos itens cotou e ticket médio. Clique
        em um fornecedor para ver tudo que ele ofertou.
      </>
    )
  },
  {
    Icone: FileDown,
    titulo: 'Exportar Excel',
    texto: <>Botão <strong>Excel</strong> na Busca gera uma planilha com o resumo por item + todos os lances (respeita os filtros).</>
  },
  {
    Icone: Combine,
    titulo: 'Juntar itens parecidos',
    texto: (
      <>
        No Catálogo, <strong>“Juntar parecidos”</strong> une o mesmo produto escrito de formas diferentes — o histórico
        vira um só e a busca fica limpa.
      </>
    )
  }
]

export function Novidades({ onFechar, irPara }: { onFechar: () => void; irPara: (p: Pagina) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 text-white">
              <PartyPopper className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Novidade na área! 🎉</h2>
              <p className="text-xs text-zinc-500">O que há de novo no LicitaPreços</p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-5">
          {ITENS.map((it, i) => (
            <div key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                <it.Icone className="h-4 w-4" />
              </span>
              <div className="text-sm text-zinc-700">
                <p className="font-semibold text-zinc-900">{it.titulo}</p>
                <p className="leading-relaxed">{it.texto}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <Button variant="ghost" onClick={onFechar}>
            Entendi
          </Button>
          <Button
            onClick={() => {
              onFechar()
              irPara('painel')
            }}
          >
            <LayoutDashboard className="h-4 w-4" /> Ver o Painel
          </Button>
        </div>
      </div>
    </div>
  )
}
