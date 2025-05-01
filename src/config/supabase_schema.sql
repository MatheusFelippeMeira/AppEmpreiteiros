-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  perfil TEXT NOT NULL DEFAULT 'usuario',
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para sessões (necessária para connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Tabela de Funcionários
CREATE TABLE IF NOT EXISTS funcionarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  contato TEXT,
  funcao TEXT NOT NULL,
  valor_diaria REAL NOT NULL DEFAULT 0,
  valor_hora_extra REAL NOT NULL DEFAULT 0,
  valor_empreitada REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  contato TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  tipo TEXT NOT NULL DEFAULT 'pessoa_fisica',
  cpf_cnpj TEXT,
  observacoes TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Projetos/Obras
CREATE TABLE IF NOT EXISTS projetos (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cliente_id INTEGER,
  localidade TEXT NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  data_inicio DATE NOT NULL,
  data_fim_prevista DATE,
  data_fim_real DATE,
  valor_receber REAL NOT NULL DEFAULT 0,
  deslocamento_incluido BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  observacoes TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes (id)
);

-- Tabela de Trabalhos (registros de dias trabalhados por funcionários em projetos)
CREATE TABLE IF NOT EXISTS trabalhos (
  id SERIAL PRIMARY KEY,
  funcionario_id INTEGER NOT NULL,
  projeto_id INTEGER NOT NULL,
  data DATE NOT NULL,
  dias_trabalhados REAL DEFAULT 1,
  horas_extras REAL DEFAULT 0,
  empreitada BOOLEAN NOT NULL DEFAULT FALSE,
  valor_empreitada REAL DEFAULT 0,
  observacoes TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (funcionario_id) REFERENCES funcionarios (id),
  FOREIGN KEY (projeto_id) REFERENCES projetos (id)
);

-- Tabela de Adiantamentos para funcionários
CREATE TABLE IF NOT EXISTS adiantamentos (
  id SERIAL PRIMARY KEY,
  funcionario_id INTEGER NOT NULL,
  valor REAL NOT NULL,
  data DATE NOT NULL,
  descricao TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (funcionario_id) REFERENCES funcionarios (id)
);

-- Tabela de Gastos em projetos
CREATE TABLE IF NOT EXISTS gastos (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL,
  data DATE NOT NULL,
  comprovante_url TEXT,
  observacoes TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (projeto_id) REFERENCES projetos (id)
);

-- Tabela de Orçamentos
CREATE TABLE IF NOT EXISTS orcamentos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER,
  titulo TEXT NOT NULL,
  descricao TEXT,
  valor_estimado REAL,
  tipo_obra TEXT,
  localidade TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes (id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_funcionarios_nome ON funcionarios(nome);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON projetos(status);
CREATE INDEX IF NOT EXISTS idx_projetos_cliente ON projetos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_trabalhos_funcionario ON trabalhos(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_trabalhos_projeto ON trabalhos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_trabalhos_data ON trabalhos(data);
CREATE INDEX IF NOT EXISTS idx_adiantamentos_funcionario ON adiantamentos(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_gastos_projeto ON gastos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos(categoria);
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(cliente_id);

-- Configuração de RLS (Row Level Security) para o Supabase
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE trabalhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE adiantamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;

-- Políticas básicas de segurança (ajuste conforme necessário)
CREATE POLICY "Usuários podem ver seus próprios dados" ON usuarios
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Administradores podem ver todos os funcionários" ON funcionarios
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.perfil = 'admin'
    )
  );

CREATE POLICY "Usuários podem ver todos os clientes" ON clientes
  FOR SELECT USING (true);

CREATE POLICY "Administradores podem gerenciar clientes" ON clientes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.perfil = 'admin'
    )
  );

CREATE POLICY "Usuários podem ver todos os projetos" ON projetos
  FOR SELECT USING (true);

CREATE POLICY "Administradores podem gerenciar projetos" ON projetos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.perfil = 'admin'
    )
  );

-- Triggers para atualizar data_atualizacao automaticamente
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.data_atualizacao = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_usuarios_timestamp
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_funcionarios_timestamp
BEFORE UPDATE ON funcionarios
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_clientes_timestamp
BEFORE UPDATE ON clientes
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_projetos_timestamp
BEFORE UPDATE ON projetos
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_orcamentos_timestamp
BEFORE UPDATE ON orcamentos
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();