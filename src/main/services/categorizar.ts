// Sugestão de categoria por IA (Groq) para itens novos criados na importação.
// Trava numa lista fixa de categorias do domínio (Caixa Escolar) para dar consistência:
// itens parecidos caem na mesma categoria e o usuário revisa antes de salvar.
import Groq from 'groq-sdk'

export const CATEGORIAS = [
  'Papelaria',
  'Material escolar',
  'Material pedagógico',
  'Limpeza',
  'Higiene',
  'Copa e cozinha',
  'Alimentos / merenda',
  'Informática',
  'Elétrica',
  'Hidráulica',
  'Construção / manutenção',
  'Mobiliário',
  'Esportivo',
  'EPI / segurança',
  'Descartáveis',
  'Outros'
] as const

const LOTE = 50 // categoriza em blocos p/ não estourar o contexto em mapas grandes

/** Retorna uma categoria (da lista fixa) para cada descrição, na mesma ordem. Fallback: "Outros". */
export async function categorizar(apiKey: string, model: string, descricoes: string[]): Promise<string[]> {
  if (!apiKey) {
    throw new Error('Chave da API Groq não configurada. Abra Configurações e informe sua chave (console.groq.com).')
  }
  if (descricoes.length === 0) return []

  const groq = new Groq({ apiKey })
  const resultado: string[] = new Array(descricoes.length).fill('Outros')

  for (let ini = 0; ini < descricoes.length; ini += LOTE) {
    const bloco = descricoes.slice(ini, ini + LOTE)
    const lista = bloco.map((d, i) => `${i}: ${d}`).join('\n')
    const prompt = `Categorize cada item de material de licitação de Caixa Escolar (papelaria, limpeza, merenda etc.).
Escolha para cada um SOMENTE uma categoria da lista permitida, copiando o texto exatamente. Se não encaixar em nenhuma, use "Outros".

CATEGORIAS PERMITIDAS: ${CATEGORIAS.join(', ')}

ITENS (índice: descrição):
${lista}

Responda apenas em JSON no formato {"itens":[{"i":0,"categoria":"Papelaria"}, ...]} cobrindo TODOS os índices de 0 a ${bloco.length - 1}.`

    const resp = await groq.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Você categoriza materiais de licitação escolar. Responda somente com JSON válido.'
        },
        { role: 'user', content: prompt }
      ]
    })

    const txt = resp.choices[0]?.message?.content ?? '{}'
    try {
      const parsed = JSON.parse(txt) as { itens?: { i: number; categoria: string }[] }
      for (const it of parsed.itens ?? []) {
        const idx = ini + Number(it.i)
        if (idx < ini || idx >= ini + bloco.length) continue
        resultado[idx] = (CATEGORIAS as readonly string[]).includes(it.categoria) ? it.categoria : 'Outros'
      }
    } catch {
      // bloco fica como "Outros" — não derruba a categorização dos demais
    }
  }

  return resultado
}
