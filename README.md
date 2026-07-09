# LicitaPreços

App desktop local (Windows, single-user) de histórico de preços de mapas de apuração de
licitação para Caixas Escolares. Electron + React + SQLite (better-sqlite3) + Groq (tool calling).

## Comandos

```bash
pnpm install        # postinstall já baixa o prebuild do better-sqlite3 p/ Electron
pnpm dev            # roda o app em desenvolvimento
pnpm typecheck      # tsc --noEmit
pnpm smoke          # teste E2E dos serviços em Node puro (troca o ABI e devolve no fim)
pnpm dist           # gera o instalador NSIS em release/
```

## Pontos de atenção

- **Sem Visual Studio na máquina**: o better-sqlite3 usa prebuild oficial via
  `scripts/native.mjs` (`electron` ou `node`). Por isso `npmRebuild: false` no
  electron-builder.yml. **Electron fica pinado na série 42** — antes de subir de major,
  confira se existe prebuild `electron-vXXX-win32-x64` em
  https://github.com/WiseLibs/better-sqlite3/releases para a versão do better-sqlite3 em uso.
- Se `pnpm dev` reclamar de ABI (`was compiled against a different Node.js version`),
  rode `node scripts/native.mjs electron`.
- **exceljs é bundlado no main** (`externalizeDepsPlugin({ exclude: ['exceljs'] })`):
  externo, o electron-builder deduplica errado os `readable-stream` aninhados e o app
  empacotado quebra com `Cannot find module 'readable-stream/passthrough'`.
- Dados do app: `%APPDATA%\LicitaPrecos\licitaprecos.db` (+ `config.json` com a chave Groq).
  Igual em dev e empacotado (`app.setPath('userData')` fixo no main).

## Auto-update

`electron-builder.yml` publica em GitHub Releases (`ThonBlack/licita-precos`). Fluxo de release:

1. Criar o repo `licita-precos` no GitHub (pode ser privado? **não** — electron-updater com
   repo privado exige token no cliente; usar repo público ou mudar de provider).
2. Subir a versão em `package.json`.
3. `$env:GH_TOKEN='<token>'; pnpm dist -- --publish always`
4. Publicar a release draft no GitHub. O app instalado atualiza sozinho na próxima abertura.

Sem release publicada, o `checkForUpdatesAndNotify` falha em silêncio — não afeta o app.

## Arquitetura (resumo)

- `src/main/` — processo principal: SQLite, matching fuzzy (fuse.js + normalização),
  parser/gerador de xlsx (exceljs), chat Groq com 2 ferramentas (`buscar_item_canonico`,
  `consultar_historico`), IPC.
- `src/preload/` — expõe `window.api` tipada (contextIsolation on).
- `src/renderer/` — React + Tailwind v4; telas: Buscar, Perguntar (IA), Importar, Catálogo,
  Configurações.
- `src/shared/types.ts` — contrato IPC único.
- Regra de ouro da IA: o modelo **nunca** responde número de memória; todo valor vem de
  tool call que consulta o SQLite.

## Limiares do matcher (`src/main/services/matcher.ts`)

- `>= 0.92` associa sozinho na importação (exato normalizado = 1.0)
- `>= 0.55` vira sugestão para confirmar
- `>= 0.75` resolve direto na tela Buscar

Cada confirmação manual grava alias (`origem = confirmado_usuario`) — na reimportação a
mesma descrição vira match exato.
