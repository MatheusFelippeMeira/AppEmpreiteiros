require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const { mkdirp } = require('mkdirp');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const db = require('./src/config/database');

// Inicialização do app
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do modo de execução
const isDev = process.env.NODE_ENV !== 'production';

// Se estiver em produção (Render), confiar no proxy
if (!isDev) {
  app.set('trust proxy', 1);
}

// Garantir que os diretórios necessários existam
mkdirp(process.env.UPLOAD_DIR || './src/public/uploads').catch(err => {
  console.error('Erro ao criar diretório de uploads:', err);
});

// Configuração do view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './src/views'));
app.set('layout', 'layouts/main');
app.use(expressLayouts);

// Middlewares de segurança e performance
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "code.jquery.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.googleapis.com", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));
app.use(cors());
app.use(compression()); // Comprimir respostas

// Middlewares padrão
app.use(express.static(path.join(__dirname, './src/public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan(isDev ? 'dev' : 'combined'));
app.use(methodOverride('_method'));

// Configuração da sessão
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: !isDev, // Em produção, requer HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 1 dia
    sameSite: 'lax'
  }
}));

// Middleware para disponibilizar dados comuns em todos os templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAuthenticated = !!req.session.user;
  res.locals.isDev = isDev;
  res.locals.currentYear = new Date().getFullYear();
  // Adicionar suporte a mensagens flash
  res.locals.flashMessage = req.session.flashMessage;
  delete req.session.flashMessage;
  next();
});

// Middleware para logs de requisições
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Inicialização do banco de dados
const initDb = async () => {
  try {
    // Ler e executar o script SQL
    const sqlScript = fs.readFileSync(path.join(__dirname, './src/config/schema.sql'), 'utf8');
    
    // Dividir o script em instruções separadas e executá-las
    const statements = sqlScript.split(';').filter(stmt => stmt.trim());
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.promiseRun(stmt);
      }
    }
    
    console.log('Banco de dados inicializado com sucesso');
    
    // Verificar se já existe um usuário admin, se não, criar
    const adminExists = await db.promiseGet('SELECT id FROM usuarios WHERE email = ?', ['admin@exemplo.com']);
    
    if (!adminExists) {
      const bcrypt = require('bcrypt');
      const hashSenha = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
      
      await db.promiseRun(
        'INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
        ['Administrador', process.env.ADMIN_EMAIL || 'admin@exemplo.com', hashSenha, 'admin']
      );
      
      console.log('Usuário administrador criado com sucesso');
    }
  } catch (err) {
    console.error('Erro ao inicializar banco de dados:', err);
  }
};

// Verificação de Saúde para o Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Rotas
app.use('/', require('./src/routes/dashboard'));
app.use('/auth', require('./src/routes/auth'));
app.use('/projetos', require('./src/routes/projetos'));
app.use('/funcionarios', require('./src/routes/funcionarios'));
app.use('/orcamentos', require('./src/routes/orcamentos'));
app.use('/relatorios', require('./src/routes/relatorios'));

// Rota para página 404
app.use((req, res) => {
  res.status(404).render('error', { 
    title: 'Página não encontrada',
    message: 'A página que você está procurando não existe ou foi movida.'
  });
});

// Handler de erros
app.use((err, req, res, next) => {
  console.error('Erro na aplicação:', err);
  
  res.status(err.status || 500).render('error', {
    title: 'Erro',
    message: isDev ? err.message : 'Ocorreu um erro interno no servidor.',
    error: isDev ? err : {}
  });
});

// Inicializar banco de dados e iniciar servidor
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Ambiente: ${isDev ? 'desenvolvimento' : 'produção'}`);
  });
}).catch(err => {
  console.error('Falha ao iniciar aplicação:', err);
});

// Gerenciamento de encerramento para o Render
process.on('SIGINT', () => {
  console.log('Recebido sinal SIGINT. Encerrando aplicação graciosamente.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Recebido sinal SIGTERM. Encerrando aplicação graciosamente.');
  process.exit(0);
});

// Exportar app para testes
module.exports = app;