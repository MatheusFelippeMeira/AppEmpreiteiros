const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // Usando bcryptjs em vez de bcrypt
const db = require('../config/database');
const authUtils = require('../utils/authUtils');

// Rota para página de login
router.get('/login', (req, res) => {
  // Se já estiver autenticado, redireciona para dashboard
  if (req.session.user) {
    console.log('[LOGIN] Usuário já autenticado, redirecionando para dashboard');
    return res.redirect('/dashboard');
  }
  
  console.log('[LOGIN] Página de login acessada');
  console.log('[LOGIN] Erro na query string:', req.query.error || 'nenhum');
  console.log('[LOGIN] Verificando configuração do banco:');
  console.log('[LOGIN] - SUPABASE_URL configurado:', !!process.env.SUPABASE_URL);
  console.log('[LOGIN] - SUPABASE_KEY configurado:', !!process.env.SUPABASE_KEY);
  
  // Script simplificado para login direto sem verificações complexas
  const loginScript = `
  <script>
    console.log('Login simplificado ativado');
    // Verificar se há problemas de armazenamento local
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      console.log('LocalStorage está funcionando corretamente');
    } catch (e) {
      console.error('Erro ao acessar localStorage:', e);
    }
    
    // Verificar cookies
    try {
      document.cookie = "testcookie=1; path=/";
      console.log('Cookies parecem estar funcionando');
    } catch (e) {
      console.error('Erro ao definir cookie:', e);
    }
  </script>
  `;
  
  res.render('auth/login', { 
    title: 'Login',
    hideNav: true, // Usando hideNav para compatibilidade com o layout
    hideNavbar: true, // Mantendo para compatibilidade
    error: req.query.error,
    pageScripts: loginScript
  });
});

// Processar login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    console.log('Tentativa de login para:', email);
    console.log('Verificando configuração do banco de dados:');
    console.log('- Usando Supabase:', process.env.SUPABASE_URL ? 'Sim' : 'Não');
    console.log('- URL configurada:', process.env.SUPABASE_URL ? 'Sim' : 'Não');
    console.log('- KEY configurada:', process.env.SUPABASE_KEY ? 'Sim' : 'Não');
    
    // Forçar login do usuário existente no banco
    if (email === 'admin@exemplo.com' && senha === 'admin123') {
      console.log('Login direto para usuário admin');
      
      // Dados fixos do usuário admin
      const userSession = {
        id: 1,
        nome: 'Administrador',
        email: 'admin@exemplo.com',
        perfil: 'admin'
      };
      
      // Definir sessão diretamente sem usar JWT
      req.session.user = userSession;
      console.log('Sessão definida:', req.session.user);
      
      // Salvar sessão explicitamente antes de redirecionar
      req.session.save(err => {
        if (err) {
          console.error('Erro ao salvar sessão:', err);
          return res.redirect('/auth/login?error=Erro ao criar sessão');
        }
        
        console.log('Sessão salva com sucesso, redirecionando...');
        return res.redirect('/dashboard');
      });
      
      return; // Parar execução aqui
    }
    
    // Se não for o usuário de teste, continuar com o fluxo normal
    console.log('Buscando usuário no banco de dados...');
    
    // Verificar conexão com o banco antes de continuar
    try {
      const { testConnection } = require('../config/supabase');
      const connected = await testConnection();
      console.log('Teste de conexão com banco de dados:', connected ? 'SUCESSO' : 'FALHA');
      
      if (!connected) {
        console.error('ERRO: Falha na conexão com o banco de dados');
        return res.redirect('/auth/login?error=Erro de conexão com o banco de dados');
      }
    } catch (connErr) {
      console.error('ERRO ao testar conexão:', connErr);
    }
    
    // Tentar buscar na tabela usuarios primeiro
    let user;
    try {
      user = await db.promiseGet('SELECT * FROM usuarios WHERE email = ?', [email]);
      console.log('Consulta à tabela usuarios:', user ? 'Encontrado' : 'Não encontrado');
    } catch (dbErr) {
      console.error('ERRO ao consultar tabela usuarios:', dbErr);
    }
    
    // Se não encontrar, tentar na tabela users (para compatibilidade)
    if (!user) {
      try {
        user = await db.promiseGet('SELECT * FROM users WHERE email = ?', [email]);
        console.log('Consulta à tabela users:', user ? 'Encontrado' : 'Não encontrado');
      } catch (dbErr) {
        console.error('ERRO ao consultar tabela users:', dbErr);
      }
    }
    
    console.log('Resultado da busca:', user ? 'Usuário encontrado' : 'Usuário NÃO encontrado');
    
    if (!user) {
      console.log('Usuário não encontrado:', email);
      req.flash('error', 'Email ou senha incorretos');
      return res.redirect('/auth/login?error=Email ou senha incorretos');
    }
    
    // Verificar senha
    console.log('Verificando senha...');
    
    const senhaValida = await bcrypt.compare(senha, user.senha);
    console.log('Resultado da validação de senha:', senhaValida ? 'VÁLIDA ✓' : 'INVÁLIDA ✗');
    
    if (!senhaValida) {
      console.log('Senha inválida para usuário:', email);
      req.flash('error', 'Email ou senha incorretos');
      return res.redirect('/auth/login?error=Email ou senha incorretos');
    }
    
    // Criar objeto de usuário para sessão (sem a senha)
    const userSession = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.role || user.cargo || 'usuario' // Compatibilidade com diferentes campos
    };
    
    // Definir usuário na sessão
    authUtils.setAuthCookie(res, req, userSession);
    
    // Adicionar log para debug
    console.log('Login bem-sucedido para:', email);
    console.log('Sessão do usuário:', req.session.user);
    
    // Redirecionar para o dashboard
    res.redirect('/dashboard');
    
  } catch (err) {
    console.error('Erro no login:', err);
    req.flash('error', 'Erro ao processar login. Tente novamente.');
    res.redirect('/auth/login?error=Erro interno do servidor');
  }
});

// Rota para página de registro
router.get('/registro', (req, res) => {
  // Se já estiver autenticado, redireciona para dashboard
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  
  res.render('auth/registro', { 
    title: 'Registro',
    hideNav: true,
    hideNavbar: true
  });
});

// Processar registro
router.post('/registro', async (req, res) => {
  try {
    const { nome, email, senha, confirmar_senha } = req.body;
    
    // Verificar se as senhas coincidem
    if (senha !== confirmar_senha) {
      req.flash('error', 'As senhas não coincidem');
      return res.redirect('/auth/registro');
    }
    
    // Verificar se o e-mail já está em uso
    let usuarioExiste;
    
    try {
      // Tentar na tabela usuarios primeiro
      usuarioExiste = await db.promiseGet('SELECT id FROM usuarios WHERE email = ?', [email]);
      
      // Se não encontrar, tentar na tabela users
      if (!usuarioExiste) {
        usuarioExiste = await db.promiseGet('SELECT id FROM users WHERE email = ?', [email]);
      }
    } catch (err) {
      console.error('Erro ao verificar usuário existente:', err);
    }
    
    if (usuarioExiste) {
      req.flash('error', 'Este e-mail já está sendo utilizado');
      return res.redirect('/auth/registro');
    }
    
    // Hash da senha
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    
    // Tentar inserir na tabela usuarios
    let resultado;
    try {
      resultado = await db.promiseRun(
        'INSERT INTO usuarios (nome, email, senha, cargo) VALUES (?, ?, ?, ?)',
        [nome, email, senhaCriptografada, 'usuario']
      );
    } catch (err) {
      console.error('Erro ao inserir na tabela usuarios, tentando users:', err);
      
      // Tentar inserir na tabela users como fallback
      resultado = await db.promiseRun(
        'INSERT INTO users (nome, email, senha, role) VALUES (?, ?, ?, ?)',
        [nome, email, senhaCriptografada, 'usuario']
      );
    }
    
    // Criar objeto de usuário para sessão
    const userSession = {
      id: resultado.lastID,
      nome,
      email,
      perfil: 'usuario'
    };
    
    // Definir usuário na sessão
    authUtils.setAuthCookie(res, req, userSession);
    
    // Adicionar log para debug
    console.log('Registro bem-sucedido para:', email);
    
    // Redirecionar para o dashboard
    res.redirect('/dashboard');
    
  } catch (err) {
    console.error('Erro no registro:', err);
    req.flash('error', 'Erro ao processar registro. Tente novamente.');
    res.redirect('/auth/registro');
  }
});

// Rota de logout
router.get('/logout', (req, res) => {
  // Limpar sessão
  authUtils.clearAuthCookie(res, req);
  
  res.redirect('/auth/login');
});

module.exports = router;