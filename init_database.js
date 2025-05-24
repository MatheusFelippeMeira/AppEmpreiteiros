const fs = require('fs');
const path = require('path');
const db = require('./src/config/database');

// Função para criar as tabelas do banco de dados
async function initDatabase() {
  try {
    console.log('Iniciando criação do banco de dados...');
    
    // Criar tabela de usuários
    await db.promiseRun(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        cargo TEXT,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ultimo_acesso TIMESTAMP
      )
    `);
    console.log('Tabela usuarios criada');
    
    // Criar tabela de clientes
    await db.promiseRun(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT,
        telefone TEXT,
        endereco TEXT,
        cidade TEXT,
        estado TEXT,
        cep TEXT,
        cpf_cnpj TEXT,
        tipo TEXT CHECK (tipo IN ('pessoa_fisica', 'pessoa_juridica')),
        observacoes TEXT,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabela clientes criada');
    
    // Criar tabela de projetos
    await db.promiseRun(`
      CREATE TABLE IF NOT EXISTS projetos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER REFERENCES clientes(id),
        nome TEXT NOT NULL,
        descricao TEXT,
        tipo TEXT,
        localidade TEXT,
        data_inicio DATE,
        data_fim_prevista DATE,
        data_fim_real DATE,
        valor_receber DECIMAL(10,2),
        status TEXT CHECK (status IN ('em_andamento', 'concluido', 'cancelado', 'pendente')),
        deslocamento_incluido INTEGER DEFAULT 0,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao TIMESTAMP
      )
    `);
    console.log('Tabela projetos criada');
    
    // Criar tabela de funcionários
    await db.promiseRun(`
      CREATE TABLE IF NOT EXISTS funcionarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cpf TEXT,
        contato TEXT,
        endereco TEXT,
        data_nascimento DATE,
        data_contratacao DATE,
        funcao TEXT,
        valor_diaria DECIMAL(10,2),
        valor_hora_extra DECIMAL(10,2),
        valor_empreitada DECIMAL(10,2),
        status TEXT CHECK (status IN ('ativo', 'inativo')),
        observacoes TEXT,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao TIMESTAMP
      )
    `);
    console.log('Tabela funcionarios criada');
    
    // Criar tabela de orçamentos
    await db.promiseRun(`
      CREATE TABLE IF NOT EXISTS orcamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER REFERENCES clientes(id),
        projeto_id INTEGER REFERENCES projetos(id),
        titulo TEXT NOT NULL,
        descricao TEXT,
        valor_total DECIMAL(10,2) NOT NULL,
        tipo_obra TEXT,
        localidade TEXT,
        status TEXT CHECK (status IN ('pendente', 'aprovado', 'recusado')),
        margem_lucro DECIMAL(5,2) DEFAULT 20,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao TIMESTAMP
      )
    `);
    console.log('Tabela orcamentos criada');
    
    // Criar tabela de itens de orçamento
    await db.promiseRun(`
      CREATE TABLE IF NOT EXISTS orcamento_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orcamento_id INTEGER NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('material', 'mao_obra')),
        descricao TEXT NOT NULL,
        quantidade INTEGER DEFAULT 1,
        valor_unitario DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE
      )
    `);
    console.log('Tabela orcamento_itens criada');
    
    // Criar tabela de gastos
    await db.promiseRun(`
      CREATE TABLE IF NOT EXISTS gastos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projeto_id INTEGER REFERENCES projetos(id),
        categoria TEXT NOT NULL,
        descricao TEXT NOT NULL,
        valor DECIMAL(10,2) NOT NULL,
        data DATE NOT NULL,
        comprovante_url TEXT,
        observacoes TEXT,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabela gastos criada');
    
    // Criar tabela de trabalhos
    await db.promiseRun(`
      CREATE TABLE IF NOT EXISTS trabalhos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projeto_id INTEGER REFERENCES projetos(id),
        funcionario_id INTEGER REFERENCES funcionarios(id),
        data DATE NOT NULL,
        dias_trabalhados INTEGER DEFAULT 0,
        horas_extras DECIMAL(5,2) DEFAULT 0,
        empreitada INTEGER DEFAULT 0,
        valor_empreitada DECIMAL(10,2),
        observacoes TEXT,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabela trabalhos criada');
    
    // Criar tabela de adiantamentos
    await db.promiseRun(`
      CREATE TABLE IF NOT EXISTS adiantamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        funcionario_id INTEGER REFERENCES funcionarios(id),
        valor DECIMAL(10,2) NOT NULL,
        data DATE NOT NULL,
        motivo TEXT,
        observacoes TEXT,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabela adiantamentos criada');
    
    // Criar índices para melhorar performance
    await db.promiseRun("CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(cliente_id)");
    await db.promiseRun("CREATE INDEX IF NOT EXISTS idx_orcamentos_projeto ON orcamentos(projeto_id)");
    await db.promiseRun("CREATE INDEX IF NOT EXISTS idx_orcamento_itens ON orcamento_itens(orcamento_id)");
    await db.promiseRun("CREATE INDEX IF NOT EXISTS idx_gastos_projeto ON gastos(projeto_id)");
    await db.promiseRun("CREATE INDEX IF NOT EXISTS idx_trabalhos_projeto ON trabalhos(projeto_id)");
    await db.promiseRun("CREATE INDEX IF NOT EXISTS idx_trabalhos_funcionario ON trabalhos(funcionario_id)");
    await db.promiseRun("CREATE INDEX IF NOT EXISTS idx_adiantamentos_funcionario ON adiantamentos(funcionario_id)");
    console.log('Índices criados');
    
    // Inserir usuário admin padrão
    const adminExists = await db.promiseGet("SELECT id FROM usuarios WHERE email = ?", ["admin@exemplo.com"]);
    if (!adminExists) {
      await db.promiseRun(
        "INSERT INTO usuarios (nome, email, senha, cargo) VALUES (?, ?, ?, ?)",
        ["Administrador", "admin@exemplo.com", "$2a$10$JrAQAh9QXtXPJD.7UH5Jz.ZXwI3.LO4nwH.nxTQGJcx8vH7YbU3Oe", "administrador"]
      );
      console.log('Usuário admin criado (senha: admin123)');
    }
    
    console.log('Banco de dados inicializado com sucesso!');
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error);
  } finally {
    db.close();
  }
}

// Executar a inicialização
initDatabase();