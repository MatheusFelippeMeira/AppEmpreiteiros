-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'usuario',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Funcionários
CREATE TABLE IF NOT EXISTS funcionarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cliente_id INTEGER,
  localidade TEXT NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  data_inicio DATE NOT NULL,
  data_fim_prevista DATE,
  data_fim_real DATE,
  valor_receber REAL NOT NULL DEFAULT 0,
  deslocamento_incluido BOOLEAN NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  observacoes TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes (id)
);

-- Tabela de Trabalhos (registros de dias trabalhados por funcionários em projetos)
CREATE TABLE IF NOT EXISTS trabalhos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL,
  projeto_id INTEGER NOT NULL,
  data DATE NOT NULL,
  dias_trabalhados REAL DEFAULT 1,
  horas_extras REAL DEFAULT 0,
  empreitada BOOLEAN NOT NULL DEFAULT 0,
  valor_empreitada REAL DEFAULT 0,
  observacoes TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (funcionario_id) REFERENCES funcionarios (id),
  FOREIGN KEY (projeto_id) REFERENCES projetos (id)
);

-- Tabela de Adiantamentos para funcionários
CREATE TABLE IF NOT EXISTS adiantamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL,
  valor REAL NOT NULL,
  data DATE NOT NULL,
  descricao TEXT,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (funcionario_id) REFERENCES funcionarios (id)
);

-- Tabela de Gastos em projetos
CREATE TABLE IF NOT EXISTS gastos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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