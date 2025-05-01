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
    
    // Buscar usuário pelo email
    const user = await db.promiseGet('SELECT * FROM usuarios WHERE email = ?', [email]);
    
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
    req.session.user = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil
    };
    
    // Redirecionar para o dashboard
    res.redirect('/');
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
    
    // Verificar se o e-mail já está em uso
    const usuarioExiste = await db.promiseGet('SELECT id FROM usuarios WHERE email = ?', [email]);
    
    if (usuarioExiste) {
      return res.render('auth/registro', { 
        title: 'Registro',
        hideNavbar: true,
        error: 'Este e-mail já está sendo utilizado'
      });
    }
    
    // Hash da senha
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    
    // Inserir novo usuário
    const resultado = await db.promiseRun(
      'INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      [nome, email, senhaCriptografada, 'usuario']
    );
    
    // Criar sessão para o novo usuário
    req.session.user = {
      id: resultado.lastID,
      nome,
      email,
      perfil: 'usuario'
    };
    
    // Redirecionar para o dashboard
    res.redirect('/');
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