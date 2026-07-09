import Database from 'better-sqlite3'

export type DB = Database.Database

const SCHEMA_V1 = `
CREATE TABLE itens_canonicos (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT,
  unidade_padrao TEXT,
  criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE itens_aliases (
  id INTEGER PRIMARY KEY,
  item_canonico_id INTEGER NOT NULL REFERENCES itens_canonicos(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_norm TEXT NOT NULL,
  origem TEXT,
  criado_em TEXT DEFAULT (datetime('now')),
  UNIQUE (item_canonico_id, alias_norm)
);
CREATE INDEX idx_aliases_norm ON itens_aliases(alias_norm);

CREATE TABLE mapas (
  id INTEGER PRIMARY KEY,
  origem_arquivo TEXT,
  id_compra TEXT,
  orgao TEXT,
  data_autenticacao TEXT,
  importado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE ofertas (
  id INTEGER PRIMARY KEY,
  mapa_id INTEGER NOT NULL REFERENCES mapas(id) ON DELETE CASCADE,
  item_canonico_id INTEGER REFERENCES itens_canonicos(id) ON DELETE SET NULL,
  descricao_original TEXT NOT NULL,
  quantidade REAL,
  unidade TEXT,
  proponente TEXT NOT NULL,
  valor_unitario REAL,
  valor_total REAL,
  venceu INTEGER DEFAULT 0
);
CREATE INDEX idx_ofertas_item ON ofertas(item_canonico_id);
CREATE INDEX idx_ofertas_mapa ON ofertas(mapa_id);
`

export function openDb(dbPath: string): DB {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

function migrate(db: DB): void {
  const versao = db.pragma('user_version', { simple: true }) as number
  if (versao < 1) {
    db.exec(SCHEMA_V1)
    db.pragma('user_version = 1')
  }
}
