const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const ejsLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const fs = require('fs');

// Verificar se o banco de dados precisa ser inicializado
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const dbExists = fs.existsSync(dbPath);

// Se não estamos usando Supabase e o banco de dados não existe, inicializar
if (!process.env.SUPABASE_URL && !process.env.SUPABASE_KEY && !dbExists) {
  console.log('Banco de dados SQLite não encontrado. Inicializando...');
  require('./init_database');
}

// Importar configuração do banco de dados (SQLite ou Supabase)
const db = require('./src/config/database');

// Importar configuração do Supabase
const { supabase, testConnection } = require('./src/config/supabase');
const { authMiddleware } = require('./src/utils/authUtils');

// Testar conexão com Supabase se as credenciais estiverem disponíveis
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  testConnection()
    .then(connected => {
      if (connected) {
        console.log('Usando Supabase como banco de dados');
      } else {
        console.warn('Falha ao conectar com Supabase, usando SQLite como fallback');
      }
    })
    .catch(err => {
      console.error('Erro ao testar conexão com Supabase:', err);
    });
}

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

// View engine - Configuração simplificada
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Usar EJS Layout de forma mais simples
app.use(ejsLayouts);
app.set('layout', 'layouts/main');

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src/public')));
app.use(methodOverride('_method'));
app.use(cookieParser());

// Segurança e otimização
if (isDev) {
  app.use(morgan('dev'));
} else {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "*", "data:"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://code.jquery.com", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "*"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"],
        connectSrc: ["'self'", "*"],
        objectSrc: ["'self'"]
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "no-referrer" },
  }));
  app.use(compression());
  app.use(morgan('combined'));
}

// Configuração de sessão simplificada
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'app_empreiteiros_secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: false, // Alterado para false para permitir HTTP e HTTPS
    sameSite: 'lax' // Adicionado para melhorar compatibilidade com navegadores móveis
  }
};
app.use(session(sessionConfig));
app.use(flash());

// CSRF simplificado
app.use((req, res, next) => {
  req.csrfToken = function() {
    return 'csrf-disabled';
  };
  next();
});

// Variáveis globais para views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.usuario = req.session.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.title = 'App Empreiteiros';
  res.locals.csrfToken = 'csrf-disabled';
  next();
});

// Middleware para verificar conexão com o banco de dados
app.use((req, res, next) => {
  // Verificar se a rota é estática ou de autenticação
  if (req.path.startsWith('/css') || 
      req.path.startsWith('/js') || 
      req.path.startsWith('/img') || 
      req.path === '/health' ||
      req.path === '/auth/login') {
    return next();
  }
  
  // Verificar conexão com o banco de dados
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    // Usando Supabase
    testConnection()
      .then(connected => {
        if (connected) {
          next();
        } else {
          return res.status(503).render('error', {
            title: 'Erro de Conexão',
            message: 'Não foi possível conectar ao banco de dados Supabase. Tente novamente mais tarde.',
            details: isDev ? 'Falha na conexão com Supabase' : undefined
          });
        }
      })
      .catch(err => {
        console.error('Erro ao verificar conexão com Supabase:', err);
        return res.status(503).render('error', {
          title: 'Erro de Conexão',
          message: 'Não foi possível conectar ao banco de dados. Tente novamente mais tarde.',
          details: isDev ? err.message : undefined
        });
      });
  } else {
    // Usando SQLite
    db.get("SELECT 1 as test", [], (err, row) => {
      if (err) {
        console.error('Erro de conexão com o banco de dados:', err.message);
        return res.status(503).render('error', {
          title: 'Erro de Conexão',
          message: 'Não foi possível conectar ao banco de dados. Tente novamente mais tarde.',
          details: isDev ? err.message : undefined
        });
      }
      next();
    });
  }
});

// Rotas
app.use('/auth', authRoutes);
app.use('/dashboard', authMiddleware, dashboardRoutes);
app.use('/projetos', authMiddleware, projetosRoutes);
app.use('/funcionarios', authMiddleware, funcionariosRoutes);
app.use('/orcamentos', authMiddleware, orcamentosRoutes);
app.use('/relatorios', authMiddleware, relatoriosRoutes);

// Rota principal
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/auth/login');
  }
});

// Adicionar rota de health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Tratamento de erros simplificado
app.use((req, res, next) => {
  res.status(404).render('error', {
    title: 'Página não encontrada',
    message: 'A página que você está procurando não existe.'
  });
});

app.use((err, req, res, next) => {
  console.error('ERRO:', err);
  res.status(500).render('error', {
    title: 'Erro interno',
    message: 'Ocorreu um erro no servidor. Por favor, tente novamente mais tarde.',
    details: isDev ? err.message : undefined
  });
});

// Inicialização do servidor
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT} no modo ${isDev ? 'desenvolvimento' : 'produção'}`);
  });
}

module.exports = app;