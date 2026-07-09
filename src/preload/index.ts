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
  historicoItem: invoke('historico:item'),
  perguntar: invoke('chat:perguntar'),
  exportarBackup: invoke('backup:exportar'),
  obterConfig: invoke('config:obter'),
  salvarConfig: invoke('config:salvar')
}

contextBridge.exposeInMainWorld('api', api)
