// Prompts compartilhados entre main (planilha modelo) e renderer (tela Importar).
// Sem dependências de Electron — só texto.

/** Vai na aba "Instruções" do modelo: colar foto no Claude/ChatGPT e copiar a tabela de volta. */
export const PROMPT_EXTRACAO = `Extraia os dados desta tabela de mapa de apuração de licitação e organize em uma tabela
com as colunas: Item, Descrição, Quantidade, Unidade, e uma coluna "Proponente" + "Valor"
para cada proponente que aparece na imagem. Não invente nenhum dado que não esteja
visível na imagem — se algo estiver ilegível, marque como "ILEGÍVEL" em vez de adivinhar.`

const CORPO_ANTIGRAVITY = `TAREFA
Leia cada mapa e preencha a aba "Mapa" da planilha, UMA LINHA POR ITEM, usando as colunas exatamente como já estão no cabeçalho (linha 1):
- Item: número/código do item no mapa (se houver).
- Descrição: a especificação do produto, igual ao mapa.
- Quantidade e Unidade: conforme o mapa.
- Proponente 1, Valor 1, Proponente 2, Valor 2, ...: um par por empresa que ofertou. "Valor N" é o VALOR UNITÁRIO da empresa N para aquele item.
- Vencedor: nome da empresa vencedora (opcional; em branco, o app assume o menor valor unitário).

REGRAS
- NÃO invente nenhum dado que não esteja visível no mapa. Se algo estiver ilegível, escreva ILEGÍVEL na célula em vez de adivinhar.
- Não altere os títulos das colunas da linha 1 nem crie colunas novas.
- Repita o nome do proponente em todas as linhas dele (não deixe só na primeira).
- Valores em reais; pode usar vírgula ou ponto no decimal.
- Preencha só os proponentes que existem; deixe os pares restantes em branco.

Ao terminar, salve o arquivo NO MESMO CAMINHO e me diga quantos itens preencheu e quais ficaram com algo ILEGÍVEL para eu conferir.`

/**
 * Monta o prompt para colar no Antigravity (que tem acesso aos arquivos do PC) já com os
 * caminhos reais da planilha modelo e dos mapas que o app separou — sem placeholders.
 */
export function montarPromptAntigravity(caminhoXlsx: string, caminhosMapas: string[]): string {
  const xlsx = caminhoXlsx || '[gere a planilha no app primeiro]'
  const mapas = caminhosMapas.length
    ? caminhosMapas.map((c) => `  • ${c}`).join('\n')
    : '  • [adicione as fotos/PDFs do mapa clicando em "Adicionar fotos/PDF" no app]'
  return `Você tem acesso aos arquivos deste PC. Preciso preencher a planilha modelo do app "LicitaPreços" a partir de mapas de apuração de licitação (fotos, prints ou PDFs).

ARQUIVOS
- Planilha modelo (já criada pelo app, preencha a aba "Mapa"): ${xlsx}
- Mapas de apuração para ler e transcrever:
${mapas}

${CORPO_ANTIGRAVITY}`
}
