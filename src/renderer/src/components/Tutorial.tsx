import { useState, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  DatabaseBackup,
  Rocket,
  Search,
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react'
import { Button } from './ui'

interface Passo {
  Icone: typeof Rocket
  titulo: string
  corpo: ReactNode
}

const PASSOS: Passo[] = [
  {
    Icone: Rocket,
    titulo: 'Bem-vindo ao LicitaPreços',
    corpo: (
      <>
        <p>
          Este app <strong>guarda os preços dos mapas de apuração</strong> das licitações. Depois
          você digita um produto e vê por quanto ele já saiu antes — mínimo, médio e máximo.
        </p>
        <p className="mt-2 text-zinc-500">
          É rapidinho. Vou te mostrar em 6 telas onde fica cada coisa. Pode clicar em{' '}
          <strong>Próximo</strong>.
        </p>
      </>
    )
  },
  {
    Icone: Cloud,
    titulo: '1. Os mapas aparecem em todos os PCs',
    corpo: (
      <>
        <p>
          O app usa uma pasta do <strong>Google Drive</strong> para dividir os mapas entre os
          computadores. Ele tenta achar essa pasta <strong>sozinho</strong> ao abrir.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
          <li>
            Se aparecer “sincronização desligada” em <strong>Configurações</strong>, clique em{' '}
            <strong>Detectar Google Drive</strong>.
          </li>
          <li>
            Não achou? Instale o <em>Google Drive para computador</em> e adicione a pasta
            compartilhada ao “Meu Drive”. Depois clique em Detectar de novo.
          </li>
        </ul>
      </>
    )
  },
  {
    Icone: Sparkles,
    titulo: '2. Lançar um mapa (jeito fácil, com IA)',
    corpo: (
      <>
        <p>Na aba “Importar mapa”, cartão roxo “Preencher com IA (Antigravity)”:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-600">
          <li>
            Clique <strong>Preparar mapa para IA</strong> (o app cria a planilha).
          </li>
          <li>
            Clique <strong>Adicionar fotos/PDF</strong> e escolha as fotos do mapa.
          </li>
          <li>
            Clique <strong>Copiar prompt</strong> e <strong>Abrir Antigravity</strong> — cole lá e
            mande rodar.
          </li>
          <li>
            Quando ele terminar, volte e clique <strong>Já preenchi — importar</strong>.
          </li>
        </ol>
        <p className="mt-2 text-zinc-500">
          Sem IA? Use “Baixar modelo”, preencha no Excel e “Selecionar planilha”.
        </p>
      </>
    )
  },
  {
    Icone: Search,
    titulo: '3. Conferir os itens (só na 1ª vez de cada)',
    corpo: (
      <>
        <p>
          Depois de importar, o app tenta reconhecer cada produto. O que ele{' '}
          <strong>não</strong> reconhecer, aparece em <span className="text-amber-600">amarelo</span>
          .
        </p>
        <p className="mt-2">
          Escolha o item certo (ou “Criar item novo”) e clique <strong>Salvar mapa</strong>. Da
          próxima vez ele já reconhece igual — você <strong>não</strong> precisa fazer de novo.
        </p>
      </>
    )
  },
  {
    Icone: RefreshCw,
    titulo: '4. Ver preços e sincronizar',
    corpo: (
      <>
        <p>
          Na aba <strong>Buscar</strong>, digite o produto (ex: “papel A4”) e veja o histórico de
          preços. Na aba <strong>Perguntar (IA)</strong> dá pra perguntar em português.
        </p>
        <p className="mt-2">
          O botão <strong>Sincronizar</strong> (aba Importar) manda os seus mapas e puxa os dos
          outros PCs. Quando chega mapa novo de outro PC, aparece um{' '}
          <span className="rounded-full bg-sky-500 px-1.5 text-xs text-white">número</span> no menu.
        </p>
      </>
    )
  },
  {
    Icone: DatabaseBackup,
    titulo: '5. Backup e atualização são automáticos',
    corpo: (
      <>
        <p>
          O app faz <strong>backup do banco sozinho</strong> toda vez que abre e se{' '}
          <strong>atualiza sozinho</strong> quando sai uma versão nova.
        </p>
        <p className="mt-2 text-zinc-500">
          Você não precisa fazer nada. Pra rever este tutorial depois: Configurações → “Ver tutorial
          de novo”. Pronto, pode usar! 🎉
        </p>
      </>
    )
  }
]

export function Tutorial({ onFechar }: { onFechar: () => void }) {
  const [i, setI] = useState(0)
  const passo = PASSOS[i]!
  const primeiro = i === 0
  const ultimo = i === PASSOS.length - 1
  const { Icone } = passo

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <Icone className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold text-zinc-900">{passo.titulo}</h2>
          </div>
          <button
            onClick={onFechar}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2 px-5 py-5 text-sm leading-relaxed text-zinc-700">{passo.corpo}</div>

        <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-4">
          <div className="flex gap-1.5">
            {PASSOS.map((_, idx) => (
              <span
                key={idx}
                className={
                  idx === i ? 'h-2 w-6 rounded-full bg-zinc-900' : 'h-2 w-2 rounded-full bg-zinc-300'
                }
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {primeiro ? (
              <Button variant="ghost" size="sm" onClick={onFechar}>
                Pular
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setI((v) => v - 1)}>
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
            )}
            {ultimo ? (
              <Button size="sm" onClick={onFechar}>
                Concluir
              </Button>
            ) : (
              <Button size="sm" onClick={() => setI((v) => v + 1)}>
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
