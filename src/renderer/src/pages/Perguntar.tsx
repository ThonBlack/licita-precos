import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import type { MensagemChat } from '../../../shared/types'
import type { Pagina } from '../App'
import { Alerta, Button, Empty, Spinner, Textarea, cn } from '../components/ui'

const EXEMPLOS = [
  'Qual foi o menor preço já registrado do papel sulfite A4?',
  'Quanto a Papelaria X costuma cobrar no lápis preto?',
  'Qual proponente mais venceu nos itens de limpeza?'
]

export function Perguntar({ irPara }: { irPara: (p: Pagina) => void }) {
  const [mensagens, setMensagens] = useState<MensagemChat[]>([])
  const [texto, setTexto] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, carregando])

  async function enviar(pergunta?: string) {
    const conteudo = (pergunta ?? texto).trim()
    if (!conteudo || carregando) return
    const novas: MensagemChat[] = [...mensagens, { role: 'user', content: conteudo }]
    setMensagens(novas)
    setTexto('')
    setErro(null)
    setCarregando(true)

    const res = await window.api.perguntar(novas)
    if (res.ok) {
      setMensagens([...novas, { role: 'assistant', content: res.data }])
    } else {
      setErro(res.error)
    }
    setCarregando(false)
  }

  const semChave = erro?.toLowerCase().includes('groq')

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold">Perguntar (IA)</h1>
        <p className="text-sm text-zinc-500">
          A IA consulta o banco de verdade antes de responder — nenhum valor é inventado.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4">
        {mensagens.length === 0 && (
          <div className="space-y-2">
            <Empty>Faça uma pergunta em linguagem natural sobre o histórico.</Empty>
            <div className="flex flex-wrap justify-center gap-2">
              {EXEMPLOS.map((e) => (
                <Button key={e} variant="outline" size="sm" onClick={() => enviar(e)}>
                  {e}
                </Button>
              ))}
            </div>
          </div>
        )}
        {mensagens.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
                m.role === 'user' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-900'
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {carregando && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Spinner /> consultando o histórico...
          </div>
        )}
        {erro && (
          <Alerta tipo="erro">
            {erro}{' '}
            {semChave && (
              <Button size="sm" variant="secondary" className="ml-2" onClick={() => irPara('config')}>
                Abrir Configurações
              </Button>
            )}
          </Alerta>
        )}
        <div ref={fimRef} />
      </div>

      <div className="flex gap-2">
        <Textarea
          rows={2}
          placeholder="Ex: qual foi o mais barato do lápis Faber Castell já registrado?"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              enviar()
            }
          }}
        />
        <Button onClick={() => enviar()} disabled={carregando || !texto.trim()} className="h-auto">
          <Send className="h-4 w-4" />
          Enviar
        </Button>
      </div>
    </div>
  )
}
