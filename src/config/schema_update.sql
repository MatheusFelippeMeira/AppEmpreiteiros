-- Atualização da tabela de orçamentos
ALTER TABLE orcamentos RENAME COLUMN valor_estimado TO valor_total;
ALTER TABLE orcamentos ADD COLUMN tipo_obra TEXT;
ALTER TABLE orcamentos ADD COLUMN localidade TEXT;
ALTER TABLE orcamentos ADD COLUMN projeto_id INTEGER REFERENCES projetos(id);
ALTER TABLE orcamentos ADD COLUMN margem_lucro REAL DEFAULT 20;

-- Criar tabela para itens de orçamento
CREATE TABLE IF NOT EXISTS orcamento_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orcamento_id INTEGER NOT NULL,
  tipo TEXT NOT NULL, -- 'material' ou 'mao_obra'
  descricao TEXT NOT NULL,
  quantidade INTEGER DEFAULT 1,
  valor_unitario REAL NOT NULL,
  FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE
);

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_projeto ON orcamentos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens ON orcamento_itens(orcamento_id);