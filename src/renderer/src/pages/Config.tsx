import { useEffect, useState } from 'react'
import { DatabaseBackup, Save } from 'lucide-react'
import type { ConfigApp, InfoBanco } from '../../../shared/types'
import { Alerta, Button, Card, Input, Spinner } from '../components/ui'

export function Config() {
  const [cfg, setCfg] = useState<ConfigApp>({ groqApiKey: '', groqModel: '' })
  const [info, setInfo] = useState<InfoBanco | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    void (async () => {
      const res = await window.api.obterConfig()
      if (res.ok) {
        setCfg({ groqApiKey: res.data.groqApiKey, groqModel: res.data.groqModel })
        setInfo(res.data)
      } else {
        setMsg({ tipo: 'erro', texto: res.error })
      }
      setCarregando(false)
    })()
  }, [])

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

      <Card title="Backup">
        <p className="mb-3 text-sm text-zinc-600">
          Gera uma cópia do banco de dados (.db) com todo o histórico. Sem backup, um problema no PC apaga
          tudo — exporte com frequência para uma pasta sincronizada.
        </p>
        <Button variant="outline" onClick={backup}>
          <DatabaseBackup className="h-4 w-4" /> Exportar backup
        </Button>
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
