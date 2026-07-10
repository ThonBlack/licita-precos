import { useEffect, useState } from 'react'
import { DatabaseBackup, FolderSync, GraduationCap, RefreshCw, RotateCw, Save, Search } from 'lucide-react'
import type { ConfigApp, EstadoUpdate, InfoBanco, StatusSync } from '../../../shared/types'
import { Alerta, Badge, Button, Card, Input, Spinner } from '../components/ui'

const CFG_VAZIO: ConfigApp = {
  groqApiKey: '',
  groqModel: '',
  pastaSync: '',
  deviceId: '',
  tutorialConcluido: true
}

export function Config({ onAbrirTutorial }: { onAbrirTutorial: () => void }) {
  const [cfg, setCfg] = useState<ConfigApp>(CFG_VAZIO)
  const [info, setInfo] = useState<InfoBanco | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [upd, setUpd] = useState<EstadoUpdate | null>(null)
  const [sync, setSync] = useState<StatusSync | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await window.api.obterConfig()
      if (res.ok) {
        setCfg({
          groqApiKey: res.data.groqApiKey,
          groqModel: res.data.groqModel,
          pastaSync: res.data.pastaSync,
          deviceId: res.data.deviceId,
          tutorialConcluido: res.data.tutorialConcluido
        })
        setInfo(res.data)
      } else {
        setMsg({ tipo: 'erro', texto: res.error })
      }
      const e = await window.api.estadoUpdate()
      if (e.ok) setUpd(e.data)
      const s = await window.api.statusSync()
      if (s.ok) setSync(s.data)
      setCarregando(false)
    })()
  }, [])

  const verificandoUpd = upd?.fase === 'verificando' || upd?.fase === 'baixando'

  async function salvar() {
    const res = await window.api.salvarConfig(cfg)
    setMsg(res.ok ? { tipo: 'ok', texto: 'Configurações salvas.' } : { tipo: 'erro', texto: res.error })
  }

  async function backup() {
    setMsg(null)
    const res = await window.api.exportarBackup()
    if (!res.ok) setMsg({ tipo: 'erro', texto: res.error })
    else if (res.data)
      setMsg({
        tipo: 'ok',
        texto: `Backup salvo em: ${res.data.caminho}. Guarde numa pasta sincronizada (Drive/OneDrive).`
      })
  }

  async function escolherPasta() {
    setMsg(null)
    const res = await window.api.escolherPastaSync()
    if (!res.ok) {
      setMsg({ tipo: 'erro', texto: res.error })
      return
    }
    if (!res.data) return // cancelado
    setCfg((c) => ({ ...c, pastaSync: res.data!.pasta }))
    const s = await window.api.statusSync()
    if (s.ok) setSync(s.data)
    setMsg({ tipo: 'ok', texto: 'Pasta de sincronização definida.' })
  }

  async function detectarDrive() {
    setMsg(null)
    const res = await window.api.autoDetectarPasta()
    if (!res.ok) {
      setMsg({ tipo: 'erro', texto: res.error })
      return
    }
    if (res.data.pasta) {
      setCfg((c) => ({ ...c, pastaSync: res.data.pasta }))
      const s = await window.api.statusSync()
      if (s.ok) setSync(s.data)
      setMsg({
        tipo: 'ok',
        texto: res.data.detectada
          ? `Pasta do Drive encontrada: ${res.data.pasta}`
          : `Já configurada: ${res.data.pasta}`
      })
    } else {
      setMsg({
        tipo: 'erro',
        texto:
          'Não achei a pasta "Licita Precos Mih" no Google Drive deste PC. Instale o Google Drive para computador e adicione a pasta compartilhada ao "Meu Drive" — depois clique em Detectar de novo.'
      })
    }
  }

  async function verificarUpd() {
    const res = await window.api.verificarUpdate()
    if (!res.ok) {
      setMsg({ tipo: 'erro', texto: res.error })
      return
    }
    setUpd(res.data)
    let fase = res.data.fase
    while (fase === 'verificando' || fase === 'baixando') {
      await new Promise((r) => setTimeout(r, 1500))
      const e = await window.api.estadoUpdate()
      if (!e.ok) break
      setUpd(e.data)
      fase = e.data.fase
    }
  }

  async function reiniciarUpd() {
    await window.api.instalarUpdate()
  }

  if (carregando) return <Spinner />

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Configurações</h1>

      {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}

      <Card title="IA (Groq)">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Chave da API</label>
            <Input
              type="password"
              placeholder="gsk_..."
              value={cfg.groqApiKey}
              onChange={(e) => setCfg({ ...cfg, groqApiKey: e.target.value })}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Gratuita em console.groq.com → API Keys. Usada só na aba “Perguntar (IA)”.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Modelo</label>
            <Input
              placeholder="llama-3.3-70b-versatile"
              value={cfg.groqModel}
              onChange={(e) => setCfg({ ...cfg, groqModel: e.target.value })}
            />
          </div>
          <Button onClick={salvar}>
            <Save className="h-4 w-4" /> Salvar
          </Button>
        </div>
      </Card>

      <Card title="Sincronização entre PCs">
        <p className="mb-3 text-sm text-zinc-600">
          Os mapas são divididos entre os PCs por uma pasta do <strong>Google Drive</strong>. O app tenta
          achar a pasta <strong>sozinho</strong> ao abrir. Se aparecer “sincronização desligada”, clique em{' '}
          <strong>Detectar Google Drive</strong> (precisa do Google Drive para computador instalado e a
          pasta compartilhada adicionada ao “Meu Drive”). Como alternativa, dá pra apontar a pasta na mão.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={detectarDrive}>
            <Search className="h-4 w-4" /> Detectar Google Drive
          </Button>
          <Button variant="outline" onClick={escolherPasta}>
            <FolderSync className="h-4 w-4" /> {cfg.pastaSync ? 'Trocar pasta na mão' : 'Escolher pasta na mão'}
          </Button>
          {cfg.pastaSync ? (
            <span className="break-all text-xs text-zinc-500">{cfg.pastaSync}</span>
          ) : (
            <Badge tone="yellow">sincronização desligada</Badge>
          )}
        </div>
        {sync?.erro && <p className="mt-2 text-xs text-red-600">Pasta inacessível: {sync.erro}</p>}
        {cfg.pastaSync && !sync?.erro && (
          <p className="mt-2 text-xs text-zinc-500">
            {sync?.pendentes.length
              ? `${sync.pendentes.length} mapa(s) de outros PCs prontos — vá em “Importar mapa” para adicionar.`
              : 'Em dia com a pasta.'}
          </p>
        )}
      </Card>

      <Card title="Backup">
        <p className="mb-3 text-sm text-zinc-600">
          O app já faz <strong>backup automático</strong> do banco toda vez que abre (guarda os últimos 10
          em <code className="text-xs">%APPDATA%\LicitaPrecos\backups</code>). O botão abaixo é só se você
          quiser guardar uma cópia extra manualmente, de preferência numa pasta sincronizada.
        </p>
        <Button variant="outline" onClick={backup}>
          <DatabaseBackup className="h-4 w-4" /> Exportar backup agora
        </Button>
      </Card>

      <Card title="Atualizações">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 text-sm text-zinc-600">
            <p>
              Versão instalada: <strong>{upd?.versaoAtual || '—'}</strong>
            </p>
            {upd?.fase === 'verificando' && (
              <p className="inline-flex items-center gap-1.5 text-zinc-500">
                <Spinner /> Verificando…
              </p>
            )}
            {upd?.fase === 'baixando' && (
              <p className="inline-flex items-center gap-1.5 text-zinc-500">
                <Spinner /> Baixando atualização{upd.progresso != null ? ` — ${upd.progresso}%` : ''}…
              </p>
            )}
            {upd?.fase === 'pronto' && (
              <Badge tone="green">Versão {upd.versaoNova} baixada — reinicie para aplicar</Badge>
            )}
            {upd?.fase === 'atual' && <Badge tone="green">Você já está na versão mais recente</Badge>}
            {upd?.fase === 'dev' && (
              <p className="text-xs text-zinc-400">Atualização só funciona no app instalado.</p>
            )}
            {upd?.fase === 'erro' && upd.erro && (
              <p className="text-xs text-red-600">Falha ao verificar: {upd.erro}</p>
            )}
          </div>
          {upd?.fase === 'pronto' ? (
            <Button onClick={reiniciarUpd}>
              <RotateCw className="h-4 w-4" /> Reiniciar e atualizar
            </Button>
          ) : (
            <Button variant="outline" onClick={verificarUpd} disabled={verificandoUpd || upd?.fase === 'dev'}>
              {verificandoUpd ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Verificar atualizações
            </Button>
          )}
        </div>
      </Card>

      <Card title="Ajuda">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-600">
            Esqueceu como faz alguma coisa? Reveja o passo a passo inicial.
          </p>
          <Button variant="outline" onClick={onAbrirTutorial}>
            <GraduationCap className="h-4 w-4" /> Ver tutorial de novo
          </Button>
        </div>
      </Card>

      {info && (
        <Card title="Banco de dados">
          <div className="space-y-1 text-sm text-zinc-600">
            <p>
              {info.itens} itens · {info.aliases} apelidos · {info.mapas} mapas · {info.ofertas} ofertas
            </p>
            <p className="break-all text-xs text-zinc-400">{info.dbPath}</p>
          </div>
        </Card>
      )}
    </div>
  )
}
