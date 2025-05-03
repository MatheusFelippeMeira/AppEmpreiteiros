const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/database');

// Rota para página de login
router.get('/login', (req, res) => {
  // Se já estiver autenticado, redireciona para dashboard
  if (req.session.user) {
    return res.redirect('/');
  }
  
  res.render('auth/login', { 
    title: 'Login',
    hideNavbar: true,
    error: req.query.error
  });
});

// Processar login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    
    // Buscar usuário pelo email (corrigindo nome da tabela de usuarios para users)
    const user = await db.promiseGet('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      return res.render('auth/login', { 
        title: 'Login',
        hideNavbar: true,
        error: 'Email ou senha incorretos'
      });
    }
    
    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, user.senha);
    
    if (!senhaValida) {
      return res.render('auth/login', { 
        title: 'Login',
        hideNavbar: true,
        error: 'Email ou senha incorretos'
      });
    }
    
    // Guardar usuário na sessão (exceto a senha)
    // Corrigindo o campo perfil para role para corresponder ao esquema do Supabase
    req.session.user = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.role // Usando role do banco e mapeando para perfil na sessão
    };
    
    // Adicionar log para debug
    console.log('Login bem-sucedido para:', email);
    console.log('Sessão do usuário:', req.session.user);
    
    // Salvar a sessão explicitamente antes de redirecionar
    req.session.save((err) => {
      if (err) {
        console.error('Erro ao salvar sessão:', err);
        return res.status(500).render('error', { 
          title: 'Erro', 
          message: 'Erro ao salvar sessão', 
          error: err 
        });
      }
      
      // Verificar se o cliente aceita HTML ou prefere JSON
      const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
      
      if (acceptsHtml) {
        // Redirecionar normalmente para navegadores
        console.log('Redirecionando usuário para dashboard');
        return res.redirect('/dashboard');
      } else {
        // Para requisições de API, retornar JSON com URL de redirecionamento
        console.log('Retornando JSON com URL de redirecionamento');
        return res.json({ 
          success: true, 
          redirect: '/dashboard',
          message: 'Login bem-sucedido'
        });
      }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro no processo de login', 
      error: err 
    });
  }
});

// Rota para página de registro
router.get('/registro', (req, res) => {
  // Se já estiver autenticado, redireciona para dashboard
  if (req.session.user) {
    return res.redirect('/');
  }
  
  res.render('auth/registro', { 
    title: 'Registro',
    hideNavbar: true
  });
});

// Processar registro
router.post('/registro', async (req, res) => {
  try {
    const { nome, email, senha, confirmar_senha } = req.body;
    
    // Verificar se as senhas coincidem
    if (senha !== confirmar_senha) {
      return res.render('auth/registro', { 
        title: 'Registro',
        hideNavbar: true,
        error: 'As senhas não coincidem'
      });
    }
    
    // Verificar se o e-mail já está em uso (corrigido para users)
    const usuarioExiste = await db.promiseGet('SELECT id FROM users WHERE email = ?', [email]);
    
    if (usuarioExiste) {
      return res.render('auth/registro', { 
        title: 'Registro',
        hideNavbar: true,
        error: 'Este e-mail já está sendo utilizado'
      });
    }
    
    // Hash da senha
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    
    // Inserir novo usuário (corrigido para users e role)
    const resultado = await db.promiseRun(
      'INSERT INTO users (nome, email, senha, role) VALUES (?, ?, ?, ?)',
      [nome, email, senhaCriptografada, 'usuario']
    );
    
    // Criar sessão para o novo usuário
    req.session.user = {
      id: resultado.lastID,
      nome,
      email,
      perfil: 'usuario' // Mantendo perfil na sessão para compatibilidade
    };
    
    // Adicionar log para debug
    console.log('Registro bem-sucedido para:', email);
    console.log('Sessão do usuário:', req.session.user);
    
    // Salvar a sessão explicitamente antes de redirecionar
    req.session.save((err) => {
      if (err) {
        console.error('Erro ao salvar sessão:', err);
        return res.status(500).render('error', { 
          title: 'Erro', 
          message: 'Erro ao salvar sessão', 
          error: err 
        });
      }
      
      // Verificar se o cliente aceita HTML ou prefere JSON
      const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
      
      if (acceptsHtml) {
        // Redirecionar normalmente para navegadores
        console.log('Redirecionando novo usuário para dashboard');
        return res.redirect('/dashboard');
      } else {
        // Para requisições de API, retornar JSON com URL de redirecionamento
        return res.json({ 
          success: true, 
          redirect: '/dashboard',
          message: 'Registro bem-sucedido'
        });
      }
    });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro no processo de registro', 
      error: err 
    });
  }
});

// Rota de logout
router.get('/logout', (req, res) => {
  // Destruir sessão
  req.session.destroy((err) => {
    if (err) {
      console.error('Erro ao fazer logout:', err);
    }
    
    res.redirect('/auth/login');
  });
});

module.exports = router;