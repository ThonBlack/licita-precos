// Tipos compartilhados entre main, preload e renderer. Não importar nada do Electron aqui.

export interface ItemCanonico {
  id: number
  nome: string
  categoria: string | null
  unidade_padrao: string | null
  criado_em: string
}

export interface Alias {
  id: number
  item_canonico_id: number
  alias: string
  origem: string | null
}

export interface ItemComAliases extends ItemCanonico {
  aliases: Alias[]
  totalOfertas: number
}

export interface Proposta {
  proponente: string
  valorUnitario: number | null
  valorTotal: number | null
}

export interface Sugestao {
  itemId: number
  itemNome: string
  similaridade: number
}

export type TipoMatch = 'exato' | 'forte' | 'sugestao' | 'nenhum'

export interface InfoMatch {
  tipo: TipoMatch
  itemId: number | null
  itemNome: string | null
  similaridade: number
  sugestoes: Sugestao[]
}

export interface LinhaImportacao {
  linha: number
  numeroItem: string | null
  descricao: string
  quantidade: number | null
  unidade: string | null
  propostas: Proposta[]
  vencedorInformado: string | null
  match: InfoMatch
}

export interface ImportacaoParseada {
  arquivo: string
  caminho: string
  linhas: LinhaImportacao[]
  avisos: string[]
}

export interface MetadadosMapa {
  arquivo: string
  idCompra: string | null
  orgao: string | null
  dataAutenticacao: string | null
  uuid?: string // preenchido só quando o mapa vem de outro PC (sync); senão é gerado
}

export type AcaoLinha = 'associar' | 'criar' | 'pendente' | 'pular'

export interface DecisaoLinha {
  linha: number
  acao: AcaoLinha
  itemId?: number
  novoItem?: { nome: string; categoria: string | null; unidade: string | null }
  salvarAlias: boolean
}

export interface ResumoImportacao {
  mapaId: number
  uuid: string
  ofertasCriadas: number
  itensCriados: number
  aliasesCriados: number
  linhasPuladas: number
  linhasPendentes: number
}

export interface Mapa {
  id: number
  uuid: string | null
  origem_arquivo: string | null
  id_compra: string | null
  orgao: string | null
  data_autenticacao: string | null
  importado_em: string
  totalOfertas: number
}

export interface RegistroHistorico {
  proponente: string
  valor_unitario: number | null
  valor_total: number | null
  quantidade: number | null
  unidade: string | null
  venceu: number
  descricao_original: string
  orgao: string | null
  data_autenticacao: string | null
  id_compra: string | null
}

export interface Estatisticas {
  registros: number
  mapas: number
  minimo: number | null
  mediana: number | null
  maximo: number | null
  vencedorFrequente: string | null
  ultimaData: string | null
}

export interface HistoricoItem {
  item: ItemCanonico
  stats: Estatisticas
  registros: RegistroHistorico[]
}

export interface ResultadoBusca {
  resolvido: Sugestao | null
  candidatos: Sugestao[]
}

export interface MensagemChat {
  role: 'user' | 'assistant'
  content: string
}

export interface ConfigApp {
  groqApiKey: string
  groqModel: string
  pastaSync: string // pasta compartilhada (Drive/OneDrive/rede) p/ sync entre PCs; vazio = desligado
  deviceId: string // id desta instalação (gerado 1x), vai no pacote de sync
  tutorialConcluido: boolean // false até o usuário terminar/pular o tutorial inicial
}

export interface InfoBanco {
  dbPath: string
  itens: number
  aliases: number
  mapas: number
  ofertas: number
}

export interface PendenteSync {
  uuid: string
  arquivo: string
  origemArquivo: string | null
  idCompra: string | null
  orgao: string | null
  dataAutenticacao: string | null
  totalItens: number
}

export interface StatusSync {
  pastaConfigurada: boolean
  pasta: string
  erro: string | null
  pendentes: PendenteSync[]
}

export interface ResumoSync {
  mapasImportados: number
  ofertasCriadas: number
  itensCriados: number
  falhas: number
}

/** Resultado do botão "Sincronizar": push dos mapas locais + pull dos de outros PCs. */
export interface ResumoSincronizacao extends ResumoSync {
  enviados: number
}

/** Sessão de preenchimento com IA: planilha modelo + fotos/PDFs separados numa pasta de trabalho. */
export interface SessaoMapa {
  pastaSessao: string
  caminhoXlsx: string
  caminhosMapas: string[]
}

export interface DeteccaoPasta {
  pasta: string
  detectada: boolean // true = achada agora pela auto-detecção; false = já estava configurada / não achou
}

export interface StatusAntigravity {
  instalado: boolean
  url: string
}

export type FaseUpdate = 'idle' | 'verificando' | 'baixando' | 'pronto' | 'atual' | 'erro' | 'dev'

export interface EstadoUpdate {
  fase: FaseUpdate
  versaoAtual: string
  versaoNova: string | null
  progresso: number | null
  erro: string | null
}

export type Resp<T> = { ok: true; data: T } | { ok: false; error: string }

export interface Api {
  baixarTemplate(): Promise<Resp<{ caminho: string } | null>>
  abrirImportacao(): Promise<Resp<ImportacaoParseada | null>>
  confirmarImportacao(
    meta: MetadadosMapa,
    linhas: LinhaImportacao[],
    decisoes: DecisaoLinha[]
  ): Promise<Resp<ResumoImportacao>>
  listarMapas(): Promise<Resp<Mapa[]>>
  excluirMapa(mapaId: number): Promise<Resp<null>>
  listarCatalogo(): Promise<Resp<ItemComAliases[]>>
  criarItem(dados: { nome: string; categoria: string | null; unidade: string | null }): Promise<Resp<ItemCanonico>>
  atualizarItem(
    id: number,
    dados: { nome: string; categoria: string | null; unidade: string | null }
  ): Promise<Resp<null>>
  excluirItem(id: number): Promise<Resp<null>>
  adicionarAlias(itemId: number, alias: string): Promise<Resp<null>>
  removerAlias(aliasId: number): Promise<Resp<null>>
  buscar(termo: string): Promise<Resp<ResultadoBusca>>
  historicoItem(itemId: number): Promise<Resp<HistoricoItem>>
  perguntar(mensagens: MensagemChat[]): Promise<Resp<string>>
  exportarBackup(): Promise<Resp<{ caminho: string } | null>>
  obterConfig(): Promise<Resp<ConfigApp & InfoBanco>>
  salvarConfig(cfg: Partial<ConfigApp>): Promise<Resp<null>>
  verificarUpdate(): Promise<Resp<EstadoUpdate>>
  estadoUpdate(): Promise<Resp<EstadoUpdate>>
  instalarUpdate(): Promise<Resp<null>>
  escolherPastaSync(): Promise<Resp<{ pasta: string } | null>>
  autoDetectarPasta(): Promise<Resp<DeteccaoPasta>>
  statusSync(): Promise<Resp<StatusSync>>
  importarSync(): Promise<Resp<ResumoSync>>
  sincronizar(): Promise<Resp<ResumoSincronizacao>>
  prepararMapa(): Promise<Resp<SessaoMapa>>
  adicionarArquivosMapa(pastaSessao: string): Promise<Resp<string[]>>
  importarSessao(caminhoXlsx: string): Promise<Resp<ImportacaoParseada>>
  statusAntigravity(): Promise<Resp<StatusAntigravity>>
  abrirAntigravity(): Promise<Resp<StatusAntigravity>>
}
