const express = require('express');
const router = express.Router();
const Projeto = require('../models/Projeto');
const Cliente = require('../models/Cliente');
const Funcionario = require('../models/Funcionario');
const multer = require('multer');
const path = require('path');

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../src/public/uploads/comprovantes'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Middleware para verificar se usuário está autenticado
const isAuthenticated = (req, res, next) => {
  if (req.session.userId || req.session.user) {
    next();
  } else {
    res.redirect('/auth/login');
  }
};

// Listar todos os projetos
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const projetos = await Projeto.getAll();
    res.render('projetos/index', {
      title: 'Projetos/Obras',
      projetos
    });
  } catch (err) {
    console.error('Erro ao buscar projetos:', err);
    res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao buscar projetos'
    });
  }
});

// Formulário para novo projeto
router.get('/novo', isAuthenticated, async (req, res) => {
  try {
    // Buscar todos os clientes para o formulário
    const clientes = await Cliente.getAll();
    
    res.render('projetos/form', {
      title: 'Novo Projeto/Obra',
      projeto: {},
      clientes
    });
  } catch (err) {
    console.error('Erro ao buscar clientes:', err);
    res.render('projetos/form', {
      title: 'Novo Projeto/Obra',
      projeto: {},
      clientes: [],
      error: 'Erro ao carregar dados de clientes'
    });
  }
});

// Criar novo projeto
router.post('/', isAuthenticated, async (req, res) => {
  const { nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, 
          valor_receber, deslocamento_incluido } = req.body;
  
  // Validação simples
  if (!nome || !localidade || !tipo || !data_inicio) {
    try {
      // Buscar todos os clientes novamente para o formulário
      const clientes = await Cliente.getAll();
      
      return res.status(400).render('projetos/form', {
        title: 'Novo Projeto/Obra',
        projeto: req.body,
        clientes,
        error: 'Nome, localidade, tipo e data de início são obrigatórios'
      });
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
      return res.status(400).render('projetos/form', {
        title: 'Novo Projeto/Obra',
        projeto: req.body,
        clientes: [],
        error: 'Nome, localidade, tipo e data de início são obrigatórios'
      });
    }
  }
  
  try {
    const id = await Projeto.create(req.body);
    res.redirect(`/projetos/${id}`);
  } catch (err) {
    console.error('Erro ao criar projeto:', err);
    
    try {
      // Buscar todos os clientes novamente para o formulário
      const clientes = await Cliente.getAll();
      
      return res.status(500).render('projetos/form', {
        title: 'Novo Projeto/Obra',
        projeto: req.body,
        clientes,
        error: 'Erro ao criar projeto'
      });
    } catch (clienteErr) {
      return res.status(500).render('projetos/form', {
        title: 'Novo Projeto/Obra',
        projeto: req.body,
        clientes: [],
        error: 'Erro ao criar projeto'
      });
    }
  }
});

// Visualizar um projeto específico
router.get('/:id', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  
  try {
    const projeto = await Projeto.getById(id);
    
    if (!projeto) {
      return res.status(404).render('error', { 
        title: 'Erro', 
        message: 'Projeto não encontrado'
      });
    }
    
    // Buscar gastos e trabalhos
    const gastos = await Projeto.getGastos(id);
    const trabalhos = await Projeto.getTrabalhos(id);
    const lucratividade = await Projeto.calcularLucratividade(id);
    const funcionarios = await Funcionario.getAll();
    
    // Agrupar gastos por categoria
    const gastosPorCategoria = {};
    gastos.forEach(gasto => {
      if (!gastosPorCategoria[gasto.categoria]) {
        gastosPorCategoria[gasto.categoria] = 0;
      }
      gastosPorCategoria[gasto.categoria] += gasto.valor;
    });
    
    res.render('projetos/detalhes', {
      title: `Projeto - ${projeto.nome}`,
      projeto,
      gastos,
      trabalhos,
      funcionarios,
      lucratividade,
      gastosPorCategoria
    });
  } catch (err) {
    console.error('Erro ao buscar detalhes do projeto:', err);
    return res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao buscar detalhes do projeto'
    });
  }
});

// Formulário para editar projeto
router.get('/:id/editar', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  
  try {
    const projeto = await Projeto.getById(id);
    
    if (!projeto) {
      return res.status(404).render('error', { 
        title: 'Erro', 
        message: 'Projeto não encontrado'
      });
    }
    
    // Buscar todos os clientes para o formulário
    const clientes = await Cliente.getAll();
    
    res.render('projetos/form', {
      title: `Editar - ${projeto.nome}`,
      projeto,
      clientes
    });
  } catch (err) {
    console.error('Erro ao buscar projeto para edição:', err);
    return res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao buscar projeto para edição'
    });
  }
});

// Atualizar projeto
router.post('/:id', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  const { nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, 
          data_fim_real, valor_receber, deslocamento_incluido, status } = req.body;
  
  // Validação simples
  if (!nome || !localidade || !tipo || !data_inicio) {
    try {
      // Buscar todos os clientes novamente para o formulário
      const clientes = await Cliente.getAll();
      
      return res.status(400).render('projetos/form', {
        title: 'Editar Projeto/Obra',
        projeto: { id, ...req.body },
        clientes,
        error: 'Nome, localidade, tipo e data de início são obrigatórios'
      });
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
      return res.status(400).render('projetos/form', {
        title: 'Editar Projeto/Obra',
        projeto: { id, ...req.body },
        clientes: [],
        error: 'Nome, localidade, tipo e data de início são obrigatórios'
      });
    }
  }
  
  try {
    await Projeto.update(id, req.body);
    res.redirect(`/projetos/${id}`);
  } catch (err) {
    console.error('Erro ao atualizar projeto:', err);
    
    try {
      // Buscar todos os clientes novamente para o formulário
      const clientes = await Cliente.getAll();
      
      return res.status(500).render('projetos/form', {
        title: 'Editar Projeto/Obra',
        projeto: { id, ...req.body },
        clientes,
        error: 'Erro ao atualizar projeto'
      });
    } catch (clienteErr) {
      return res.status(500).render('projetos/form', {
        title: 'Editar Projeto/Obra',
        projeto: { id, ...req.body },
        clientes: [],
        error: 'Erro ao atualizar projeto'
      });
    }
  }
});

// Excluir projeto
router.post('/:id/excluir', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  
  try {
    await Projeto.delete(id);
    res.redirect('/projetos');
  } catch (err) {
    console.error('Erro ao excluir projeto:', err);
    return res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao excluir projeto'
    });
  }
});

// Registrar gasto
router.post('/:id/gasto', isAuthenticated, upload.single('comprovante'), async (req, res) => {
  const projeto_id = req.params.id;
  const { categoria, descricao, valor, data } = req.body;
  
  // Validação simples
  if (!categoria || !descricao || !valor || !data) {
    return res.status(400).json({ 
      error: 'Categoria, descrição, valor e data são obrigatórios'
    });
  }
  
  try {
    const gasto = {
      projeto_id,
      categoria,
      descricao,
      valor,
      data,
      comprovante_url: req.file ? `/uploads/comprovantes/${req.file.filename}` : null
    };
    
    await Projeto.registrarGasto(gasto);
    res.redirect(`/projetos/${projeto_id}`);
  } catch (err) {
    console.error('Erro ao registrar gasto:', err);
    return res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao registrar gasto'
    });
  }
});

// Finalizar projeto
router.post('/:id/finalizar', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  const { data_fim_real } = req.body;
  
  // Validação simples
  if (!data_fim_real) {
    return res.status(400).json({ 
      error: 'Data de finalização é obrigatória'
    });
  }
  
  try {
    await Projeto.update(id, { data_fim_real, status: 'concluido' });
    res.redirect(`/projetos/${id}`);
  } catch (err) {
    console.error('Erro ao finalizar projeto:', err);
    return res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao finalizar projeto'
    });
  }
});

module.exports = router;