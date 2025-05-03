const express = require('express');
const router = express.Router();
const Funcionario = require('../models/Funcionario'); // Importar Model
const { body, validationResult } = require('express-validator'); // Importar express-validator

// Middleware para verificar se o usuário está autenticado
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  
  return res.redirect('/auth/login');
};

// Listar todos os funcionários com paginação
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Usar o novo método com paginação
    const resultado = await Funcionario.getAllPaginated(page, limit);
    
    res.render('funcionarios/index', { 
      title: 'Funcionários', 
      funcionarios: resultado.data,
      paginacao: {
        page: resultado.page,
        totalPages: resultado.totalPages,
        total: resultado.total,
        limit: resultado.limit
      },
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('Erro ao listar funcionários:', err);
    req.flash('error_msg', 'Não foi possível carregar a lista de funcionários.');
    res.redirect('/dashboard');
  }
});

// Formulário para cadastrar novo funcionário
router.get('/novo', isAuthenticated, (req, res) => {
  res.render('funcionarios/form', { 
    title: 'Novo Funcionário',
    funcionario: {}, // Objeto vazio para novo
    errors: [], // Array vazio para erros
    isNew: true
  });
});

// Validação para criação/edição
const funcionarioValidationRules = () => {
  return [
    body('nome').notEmpty().withMessage('Nome é obrigatório').trim().escape(),
    body('contato').optional({ checkFalsy: true }).trim().escape(),
    body('funcao').optional({ checkFalsy: true }).trim().escape(),
    body('valor_diaria').isNumeric().withMessage('Valor da diária deve ser um número').toFloat(),
    body('valor_hora_extra').isNumeric().withMessage('Valor da hora extra deve ser um número').toFloat()
  ];
};

// Criar novo funcionário
router.post('/', isAuthenticated, funcionarioValidationRules(), async (req, res) => {
  try {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.render('funcionarios/form', {
        title: 'Novo Funcionário',
        funcionario: req.body,
        errors: errors.array(),
        isNew: true
      });
    }
    
    // Se não há erros, criar funcionário
    await Funcionario.create(req.body);
    
    req.flash('success_msg', 'Funcionário cadastrado com sucesso!');
    res.redirect('/funcionarios');
  } catch (err) {
    console.error('Erro ao criar funcionário:', err);
    req.flash('error_msg', 'Erro ao criar funcionário.');
    res.redirect('/funcionarios');
  }
});

// Ver detalhes de um funcionário
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const funcionario = await Funcionario.getById(req.params.id);
    
    if (!funcionario) {
      req.flash('error_msg', 'Funcionário não encontrado.');
      return res.redirect('/funcionarios');
    }
    
    // Obter trabalhos do funcionário
    const trabalhos = await Funcionario.getTrabalhos(req.params.id);
    
    res.render('funcionarios/detalhes', {
      title: funcionario.nome,
      funcionario,
      trabalhos
    });
  } catch (err) {
    console.error('Erro ao buscar detalhes do funcionário:', err);
    req.flash('error_msg', 'Erro ao buscar detalhes do funcionário.');
    res.redirect('/funcionarios');
  }
});

// Formulário para editar funcionário
router.get('/:id/editar', isAuthenticated, async (req, res) => {
  try {
    const funcionario = await Funcionario.getById(req.params.id);
    
    if (!funcionario) {
      req.flash('error_msg', 'Funcionário não encontrado.');
      return res.redirect('/funcionarios');
    }
    
    res.render('funcionarios/form', {
      title: 'Editar Funcionário',
      funcionario,
      errors: [],
      isNew: false
    });
  } catch (err) {
    console.error('Erro ao buscar funcionário para edição:', err);
    req.flash('error_msg', 'Erro ao buscar funcionário para edição.');
    res.redirect('/funcionarios');
  }
});

// Atualizar funcionário
router.post('/:id', isAuthenticated, funcionarioValidationRules(), async (req, res) => {
  try {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.render('funcionarios/form', {
        title: 'Editar Funcionário',
        funcionario: { ...req.body, id: req.params.id },
        errors: errors.array(),
        isNew: false
      });
    }
    
    // Se não há erros, atualizar funcionário
    await Funcionario.update(req.params.id, req.body);
    
    req.flash('success_msg', 'Funcionário atualizado com sucesso!');
    res.redirect('/funcionarios');
  } catch (err) {
    console.error('Erro ao atualizar funcionário:', err);
    req.flash('error_msg', 'Erro ao atualizar funcionário.');
    res.redirect('/funcionarios');
  }
});

// Excluir funcionário
router.post('/:id/excluir', isAuthenticated, async (req, res) => {
  try {
    // Verificar se o funcionário tem trabalhos associados
    const trabalhos = await Funcionario.getTrabalhos(req.params.id);
    if (trabalhos && trabalhos.length > 0) {
      req.flash('error_msg', 'Não é possível excluir um funcionário com trabalhos registrados. Remova os trabalhos primeiro.');
      return res.redirect(`/funcionarios/${req.params.id}`);
    }
    
    // Se não há trabalhos, pode excluir
    await Funcionario.delete(req.params.id);
    
    req.flash('success_msg', 'Funcionário excluído com sucesso!');
    res.redirect('/funcionarios');
  } catch (err) {
    console.error('Erro ao excluir funcionário:', err);
    req.flash('error_msg', 'Erro ao excluir funcionário. Verifique se não há trabalhos registrados para este funcionário.');
    res.redirect('/funcionarios');
  }
});

module.exports = router;