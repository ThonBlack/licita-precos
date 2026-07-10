import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/types'

const invoke =
  (canal: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(canal, ...args)

const api: Api = {
  baixarTemplate: invoke('template:baixar'),
  abrirImportacao: invoke('importacao:abrir'),
  confirmarImportacao: invoke('importacao:confirmar'),
  listarMapas: invoke('mapas:listar'),
  excluirMapa: invoke('mapas:excluir'),
  listarCatalogo: invoke('catalogo:listar'),
  criarItem: invoke('catalogo:criarItem'),
  atualizarItem: invoke('catalogo:atualizarItem'),
  excluirItem: invoke('catalogo:excluirItem'),
  adicionarAlias: invoke('catalogo:addAlias'),
  removerAlias: invoke('catalogo:removerAlias'),
  buscar: invoke('busca:termo'),
  buscarProdutos: invoke('produtos:buscar'),
  painelResumo: invoke('painel:resumo'),
  listarFornecedores: invoke('fornecedores:lista'),
  opcoesFiltro: invoke('filtros:opcoes'),
  historicoItem: invoke('historico:item'),
  perguntar: invoke('chat:perguntar'),
  categorizarItens: invoke('ia:categorizar'),
  exportarBackup: invoke('backup:exportar'),
  zerarDados: invoke('dados:zerar'),
  obterConfig: invoke('config:obter'),
  salvarConfig: invoke('config:salvar'),
  verificarUpdate: invoke('update:verificar'),
  estadoUpdate: invoke('update:estado'),
  instalarUpdate: invoke('update:instalar'),
  escolherPastaSync: invoke('sync:escolherPasta'),
  autoDetectarPasta: invoke('sync:autoDetectar'),
  statusSync: invoke('sync:status'),
  importarSync: invoke('sync:importar'),
  sincronizar: invoke('sync:sincronizar'),
  prepararMapa: invoke('mapa:preparar'),
  adicionarArquivosMapa: invoke('mapa:adicionarArquivos'),
  importarSessao: invoke('mapa:importarSessao'),
  statusAntigravity: invoke('sys:antigravity'),
  abrirAntigravity: invoke('sys:abrirAntigravity')
}

contextBridge.exposeInMainWorld('api', api)
