-- Atualização da tabela de orçamentos
ALTER TABLE orcamentos RENAME COLUMN valor_estimado TO valor_total;
ALTER TABLE orcamentos ADD COLUMN tipo_obra TEXT;
ALTER TABLE orcamentos ADD COLUMN localidade TEXT;
ALTER TABLE orcamentos ADD COLUMN projeto_id INTEGER REFERENCES projetos(id);

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_projeto ON orcamentos(projeto_id);