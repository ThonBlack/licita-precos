import Groq from 'groq-sdk'
import type { DB } from '../db'
import type { MensagemChat } from '../../shared/types'
import { matchTermo } from './matcher'
import { historicoItem } from './historico'

const MAX_ITERACOES = 6

const SISTEMA = `Você é a assistente do LicitaPreços, um sistema local de histórico de preços de licitações de material escolar (papelaria, limpeza, cozinha) para Caixas Escolares.

Regras obrigatórias:
- NUNCA informe preços, datas, proponentes ou estatísticas de memória. Todo número da resposta deve vir do resultado das ferramentas.
- Fluxo típico: use buscar_item_canonico para resolver o item citado (funciona com marca, apelido ou termo livre); depois use consultar_historico com o id retornado.
- Se a busca não retornar nenhum candidato com similaridade >= 0.5, NÃO chute: pergunte ao usuário qual item ele quis dizer, listando os candidatos encontrados (se houver).
- Se o histórico vier vazio, diga claramente que não há registros para o item.
- Formate valores em reais (ex: R$ 3,90) e datas como DD/MM/AAAA.
- Responda em português do Brasil, de forma direta e curta.`

const FERRAMENTAS = [
  {
    type: 'function' as const,
    function: {
      name: 'buscar_item_canonico',
      description:
        'Busca itens do catálogo por nome, marca, apelido ou termo livre (busca fuzzy). Retorna candidatos com itemId, itemNome e similaridade entre 0 e 1.',
      parameters: {
        type: 'object',
        properties: {
          termo: { type: 'string', description: 'Termo de busca, ex: "Chamex" ou "lápis faber castell"' }
        },
        required: ['termo']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'consultar_historico',
      description:
        'Retorna o histórico de preços de um item canônico: registros com proponente, valor unitário, data, órgão e se venceu, além de estatísticas (mínimo, mediana, máximo, vencedor mais frequente).',
      parameters: {
        type: 'object',
        properties: {
          item_canonico_id: { type: 'number', description: 'Id do item canônico (vem de buscar_item_canonico)' },
          filtro_proponente: { type: 'string', description: 'Opcional: filtra por nome (parcial) do proponente' }
        },
        required: ['item_canonico_id']
      }
    }
  }
]

function executarFerramenta(db: DB, nome: string, args: Record<string, unknown>): unknown {
  if (nome === 'buscar_item_canonico') {
    return { candidatos: matchTermo(db, String(args.termo ?? ''), 5) }
  }
  if (nome === 'consultar_historico') {
    const h = historicoItem(
      db,
      Number(args.item_canonico_id),
      args.filtro_proponente ? String(args.filtro_proponente) : undefined
    )
    return {
      item: { id: h.item.id, nome: h.item.nome, unidade: h.item.unidade_padrao },
      estatisticas: h.stats,
      registros: h.registros.slice(0, 100)
    }
  }
  return { erro: `Ferramenta desconhecida: ${nome}` }
}

export async function perguntar(
  db: DB,
  apiKey: string,
  model: string,
  historico: MensagemChat[]
): Promise<string> {
  if (!apiKey) {
    throw new Error('Chave da API Groq não configurada. Abra Configurações e informe sua chave (console.groq.com).')
  }
  const groq = new Groq({ apiKey })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mensagens: any[] = [
    { role: 'system', content: SISTEMA },
    ...historico.map((m) => ({ role: m.role, content: m.content }))
  ]

  for (let i = 0; i < MAX_ITERACOES; i++) {
    const resposta = await groq.chat.completions.create({
      model,
      messages: mensagens,
      tools: FERRAMENTAS,
      tool_choice: 'auto',
      temperature: 0.2
    })
    const msg = resposta.choices[0]?.message
    if (!msg) throw new Error('A Groq retornou uma resposta vazia.')

    if (!msg.tool_calls?.length) return msg.content ?? ''

    mensagens.push(msg)
    for (const tc of msg.tool_calls) {
      let resultado: unknown
      try {
        const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>
        resultado = executarFerramenta(db, tc.function.name, args)
      } catch (err) {
        resultado = { erro: err instanceof Error ? err.message : String(err) }
      }
      mensagens.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(resultado) })
    }
  }
  throw new Error('A consulta excedeu o número máximo de passos de ferramenta.')
}
