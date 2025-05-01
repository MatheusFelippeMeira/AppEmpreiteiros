const express = require('express');
const path = require('path');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const flash = require('connect-flash');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const { Pool } = require('pg');

// Importação de rotas
const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const projetosRoutes = require('./src/routes/projetos');
const funcionariosRoutes = require('./src/routes/funcionarios');
const orcamentosRoutes = require('./src/routes/orcamentos');
const relatoriosRoutes = require('./src/routes/relatorios');

// Configurações
const app = express();
const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src/public')));

// Segurança e otimização
if (isDev) {
  app.use(morgan('dev'));
} else {
  app.use(helmet());
  app.use(compression());
  app.use(morgan('combined'));
}

// Configuração de sessão
let sessionConfig;

if (isDev) {
  // Configuração para desenvolvimento
  sessionConfig = {
    secret: process.env.SESSION_SECRET || 'app_empreiteiros_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 // 24 horas
    }
  };
} else {
  // Configuração para produção com PostgreSQL
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  sessionConfig = {
    store: new PgSession({
      pool,
      tableName: 'session' // Tabela para armazenar sessões
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 horas
      secure: true,
      httpOnly: true
    }
  };
}

app.use(session(sessionConfig));
app.use(flash());

// Middleware para disponibilizar variáveis globais para as views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

// Health check para o Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Rotas
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/projetos', projetosRoutes);
app.use('/funcionarios', funcionariosRoutes);
app.use('/orcamentos', orcamentosRoutes);
app.use('/relatorios', relatoriosRoutes);

// Rota principal
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/auth/login');
  }
});

// Middleware de tratamento de erros
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Página não encontrada',
    message: 'A página que você está procurando não existe.'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Erro no servidor',
    message: isDev ? err.message : 'Ocorreu um erro no servidor.'
  });
});

// Inicialização do servidor
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT} no modo ${isDev ? 'desenvolvimento' : 'produção'}`);
  });
}

module.exports = app;