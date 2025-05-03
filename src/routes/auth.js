const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/database');
const authUtils = require('../utils/authUtils');

// Rota para página de login
router.get('/login', (req, res) => {
  // Se já estiver autenticado, redireciona para dashboard
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  
  // Preparar um script específico para a página de login
  const loginScript = `
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const loginForm = document.getElementById('loginForm');
      
      if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
          event.preventDefault();
          
          // Desabilita o botão para evitar cliques múltiplos
          const submitButton = loginForm.querySelector('button[type="submit"]');
          submitButton.disabled = true;
          submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Entrando...';
          
          // Obter os dados do formulário
          const formData = new FormData(loginForm);
          const formDataObj = {};
          formData.forEach((value, key) => formDataObj[key] = value);
          
          // Enviar a requisição via fetch API
          fetch('/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(formDataObj),
            credentials: 'same-origin'
          })
          .then(response => {
            return response.json();
          })
          .then(data => {
            if (data.success) {
              console.log('Login bem-sucedido, redirecionando...');
              window.location.href = data.redirect || '/dashboard';
            } else {
              submitButton.disabled = false;
              submitButton.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Entrar';
              
              // Exibir mensagem de erro
              const errorMessage = document.getElementById('errorMessage');
              if (errorMessage) {
                errorMessage.textContent = data.message || 'Erro no login';
                errorMessage.parentElement.style.display = 'block';
              } else {
                alert(data.message || 'Erro no login');
              }
            }
          })
          .catch(error => {
            console.error('Erro ao fazer login:', error);
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Entrar';
            alert('Erro ao processar login. Por favor, tente novamente.');
          });
        });
      }
    });
  </script>
  `;
  
  res.render('auth/login', { 
    title: 'Login',
    hideNavbar: true,
    error: req.query.error,
    pageScripts: loginScript
  });
});

// Processar login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    
    // Buscar usuário pelo email (corrigindo nome da tabela de usuarios para users)
    const user = await db.promiseGet('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos'
      });
    }
    
    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, user.senha);
    
    if (!senhaValida) {
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos'
      });
    }
    
    // Criar objeto de usuário para sessão (sem a senha)
    const userSession = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.role || 'usuario' // Usando role do banco e mapeando para perfil na sessão
    };
    
    // Definir token JWT no cookie e na sessão
    authUtils.setAuthCookie(res, req, userSession);
    
    // Adicionar log para debug
    console.log('Login bem-sucedido para:', email);
    
    // Retornar resposta JSON com sucesso
    res.json({
      success: true,
      message: 'Login bem-sucedido',
      redirect: '/dashboard'
    });
    
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota para página de registro
router.get('/registro', (req, res) => {
  // Se já estiver autenticado, redireciona para dashboard
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  
  // Preparar um script específico para a página de registro
  const registroScript = `
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const registroForm = document.getElementById('registroForm');
      
      if (registroForm) {
        registroForm.addEventListener('submit', function(event) {
          event.preventDefault();
          
          // Validação básica do lado do cliente
          const senha = document.getElementById('senha').value;
          const confirmarSenha = document.getElementById('confirmar_senha').value;
          
          if (senha !== confirmarSenha) {
            alert('As senhas não coincidem!');
            return;
          }
          
          // Desabilita o botão para evitar cliques múltiplos
          const submitButton = registroForm.querySelector('button[type="submit"]');
          submitButton.disabled = true;
          submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Registrando...';
          
          // Obter os dados do formulário
          const formData = new FormData(registroForm);
          const formDataObj = {};
          formData.forEach((value, key) => formDataObj[key] = value);
          
          // Enviar a requisição via fetch API
          fetch('/auth/registro', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(formDataObj),
            credentials: 'same-origin'
          })
          .then(response => {
            return response.json();
          })
          .then(data => {
            if (data.success) {
              console.log('Registro bem-sucedido, redirecionando...');
              window.location.href = data.redirect || '/dashboard';
            } else {
              submitButton.disabled = false;
              submitButton.innerHTML = '<i class="fas fa-user-plus me-2"></i>Registrar';
              
              // Exibir mensagem de erro
              const errorMessage = document.getElementById('errorMessage');
              if (errorMessage) {
                errorMessage.textContent = data.message || 'Erro no registro';
                errorMessage.parentElement.style.display = 'block';
              } else {
                alert(data.message || 'Erro no registro');
              }
            }
          })
          .catch(error => {
            console.error('Erro ao fazer registro:', error);
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-user-plus me-2"></i>Registrar';
            alert('Erro ao processar registro. Por favor, tente novamente.');
          });
        });
      }
    });
  </script>
  `;
  
  res.render('auth/registro', { 
    title: 'Registro',
    hideNavbar: true,
    pageScripts: registroScript
  });
});

// Processar registro
router.post('/registro', async (req, res) => {
  try {
    const { nome, email, senha, confirmar_senha } = req.body;
    
    // Verificar se as senhas coincidem
    if (senha !== confirmar_senha) {
      return res.status(400).json({ 
        success: false,
        message: 'As senhas não coincidem'
      });
    }
    
    // Verificar se o e-mail já está em uso (corrigido para users)
    const usuarioExiste = await db.promiseGet('SELECT id FROM users WHERE email = ?', [email]);
    
    if (usuarioExiste) {
      return res.status(409).json({ 
        success: false,
        message: 'Este e-mail já está sendo utilizado'
      });
    }
    
    // Hash da senha
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    
    // Inserir novo usuário (corrigido para users e role)
    const resultado = await db.promiseRun(
      'INSERT INTO users (nome, email, senha, role) VALUES (?, ?, ?, ?)',
      [nome, email, senhaCriptografada, 'usuario']
    );
    
    // Criar objeto de usuário para sessão
    const userSession = {
      id: resultado.lastID,
      nome,
      email,
      perfil: 'usuario'
    };
    
    // Definir token JWT no cookie e na sessão
    authUtils.setAuthCookie(res, req, userSession);
    
    // Adicionar log para debug
    console.log('Registro bem-sucedido para:', email);
    
    // Retornar resposta JSON com sucesso
    res.json({
      success: true,
      message: 'Registro bem-sucedido',
      redirect: '/dashboard'
    });
    
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota de logout
router.get('/logout', (req, res) => {
  // Limpar cookie de autenticação e sessão
  authUtils.clearAuthCookie(res, req);
  
  res.redirect('/auth/login');
});

module.exports = router;