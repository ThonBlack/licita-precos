import ExcelJS from 'exceljs'

export const MAX_PROPONENTES = 6

export const PROMPT_EXTRACAO = `Extraia os dados desta tabela de mapa de apuração de licitação e organize em uma tabela
com as colunas: Item, Descrição, Quantidade, Unidade, e uma coluna "Proponente" + "Valor"
para cada proponente que aparece na imagem. Não invente nenhum dado que não esteja
visível na imagem — se algo estiver ilegível, marque como "ILEGÍVEL" em vez de adivinhar.`

/** Gera a planilha modelo que a usuária preenche a partir dos mapas de apuração. */
export async function gerarModelo(caminho: string): Promise<void> {
  const wb = new ExcelJS.Workbook()

  const ws = wb.addWorksheet('Mapa')
  const cabecalhos = ['Item', 'Descrição', 'Quantidade', 'Unidade']
  for (let i = 1; i <= MAX_PROPONENTES; i++) {
    cabecalhos.push(`Proponente ${i}`, `Valor ${i}`)
  }
  cabecalhos.push('Vencedor')

  const linha = ws.addRow(cabecalhos)
  linha.font = { bold: true }
  linha.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
    cell.border = { bottom: { style: 'thin' } }
  })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.getColumn(1).width = 8
  ws.getColumn(2).width = 55
  ws.getColumn(3).width = 12
  ws.getColumn(4).width = 12
  for (let i = 0; i < MAX_PROPONENTES; i++) {
    ws.getColumn(5 + i * 2).width = 24
    ws.getColumn(6 + i * 2).width = 12
  }
  ws.getColumn(5 + MAX_PROPONENTES * 2).width = 24

  const inst = wb.addWorksheet('Instruções')
  inst.getColumn(1).width = 110
  const linhas = [
    'COMO PREENCHER A ABA "Mapa"',
    '',
    '• Uma linha por item do mapa de apuração.',
    '• "Valor N" é o VALOR UNITÁRIO ofertado pelo Proponente N (use vírgula ou ponto, tanto faz).',
    '• Preencha só os proponentes que existem — deixe os demais em branco.',
    '• "Vencedor" é opcional: se ficar em branco, o sistema considera vencedor o menor valor unitário.',
    '• Não mude os títulos das colunas da linha 1.',
    '',
    'MAPA EM FOTO OU PDF ESCANEADO?',
    '',
    'Envie a foto para o Claude ou ChatGPT junto com o prompt abaixo e cole o resultado aqui:',
    '',
    ...PROMPT_EXTRACAO.split('\n'),
    '',
    'Confira sempre os valores extraídos antes de importar.'
  ]
  for (const [i, texto] of linhas.entries()) {
    const r = inst.addRow([texto])
    r.getCell(1).alignment = { wrapText: true }
    if (i === 0 || texto === 'MAPA EM FOTO OU PDF ESCANEADO?') r.font = { bold: true }
  }

  await wb.xlsx.writeFile(caminho)
}
