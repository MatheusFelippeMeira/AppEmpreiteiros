-- Esquema para o banco de dados Supabase
-- Use este arquivo para criar as tabelas necessárias no Supabase Console SQL Editor

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para sessões
CREATE TABLE IF NOT EXISTS session (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expire TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Tabela para clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  email TEXT UNIQUE,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para funcionários
CREATE TABLE IF NOT EXISTS funcionarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  cargo TEXT,
  email TEXT UNIQUE,
  telefone TEXT,
  data_contratacao DATE,
  salario DECIMAL(10, 2),
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para projetos
CREATE TABLE IF NOT EXISTS projetos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  cliente_id UUID REFERENCES clientes(id),
  responsavel_id UUID REFERENCES funcionarios(id),
  status TEXT DEFAULT 'em_andamento',
  data_inicio DATE,
  data_previsao_termino DATE,
  data_conclusao DATE,
  orcamento DECIMAL(12, 2),
  valor_final DECIMAL(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para orçamentos
CREATE TABLE IF NOT EXISTS orcamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  projeto_id UUID REFERENCES projetos(id),
  descricao TEXT NOT NULL,
  valor_materiais DECIMAL(10, 2),
  valor_mao_obra DECIMAL(10, 2),
  valor_total DECIMAL(10, 2),
  status TEXT DEFAULT 'pendente',
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_aprovacao TIMESTAMP WITH TIME ZONE,
  aprovado_por UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para relatórios
CREATE TABLE IF NOT EXISTS relatorios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT NOT NULL,
  conteudo TEXT,
  tipo TEXT,
  projeto_id UUID REFERENCES projetos(id),
  autor_id UUID REFERENCES users(id),
  data_geracao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentários para melhor compreensão do esquema
COMMENT ON TABLE users IS 'Usuários do sistema';
COMMENT ON TABLE session IS 'Armazenamento de sessões para autenticação';
COMMENT ON TABLE clientes IS 'Clientes da empresa';
COMMENT ON TABLE funcionarios IS 'Funcionários da empresa';
COMMENT ON TABLE projetos IS 'Projetos em andamento e concluídos';
COMMENT ON TABLE orcamentos IS 'Orçamentos de projetos';
COMMENT ON TABLE relatorios IS 'Relatórios gerados no sistema';

-- Inserir um usuário administrador padrão para primeiro acesso
-- IMPORTANTE: Altere esta senha após o primeiro login!
INSERT INTO users (nome, email, senha, role)
VALUES ('Admin', 'admin@admin.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin')
ON CONFLICT (email) DO NOTHING;