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
const { supabase, testConnection } = require('./src/config/supabase');
const { authMiddleware } = require('./src/utils/authUtils');

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
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
        styleSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "same-origin" },
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
    secure: !isDev,
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

// Tratamento de erros simplificado
app.use((req, res, next) => {
  res.status(404).send('Página não encontrada');
});

app.use((err, req, res, next) => {
  console.error('ERRO:', err);
  res.status(500).send('Erro interno do servidor');
});

// Inicialização do servidor
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT} no modo ${isDev ? 'desenvolvimento' : 'produção'}`);
  });
}

module.exports = app;