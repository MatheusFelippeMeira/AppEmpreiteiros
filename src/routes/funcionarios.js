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

// Listar todos os funcionários
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const funcionarios = await Funcionario.getAll(); // Usar Model
    
    res.render('funcionarios/index', { 
      title: 'Funcionários', 
      funcionarios, 
      success_msg: req.flash('success_msg'), // Passar flash messages
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('Erro ao listar funcionários:', err);
    req.flash('error_msg', 'Não foi possível carregar a lista de funcionários.');
    res.redirect('/'); // Redirecionar para dashboard em caso de erro grave
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
    body('valor_diaria').isFloat({ gt: 0 }).withMessage('Valor da diária deve ser um número positivo').toFloat(),
    body('valor_hora_extra').optional({ checkFalsy: true }).isFloat({ gt: 0 }).withMessage('Valor da hora extra deve ser um número positivo').toFloat(),
    body('valor_empreitada').optional({ checkFalsy: true }).isFloat({ gt: 0 }).withMessage('Valor da empreitada deve ser um número positivo').toFloat(),
    body('observacoes').optional({ checkFalsy: true }).trim().escape(),
    body('status').optional().isIn(['ativo', 'inativo']).withMessage('Status inválido')
  ];
};

// Cadastrar novo funcionário
router.post('/', 
  isAuthenticated, 
  funcionarioValidationRules(), // Aplicar validação
  async (req, res) => {
    const errors = validationResult(req);
    const funcionarioData = req.body;

    if (!errors.isEmpty()) {
      return res.status(400).render('funcionarios/form', {
        title: 'Novo Funcionário',
        funcionario: funcionarioData, // Manter dados no form
        errors: errors.array(),
        isNew: true
      });
    }

    try {
      await Funcionario.create(funcionarioData); // Usar Model
      req.flash('success_msg', `Funcionário ${funcionarioData.nome} cadastrado com sucesso!`);
      res.redirect('/funcionarios');
    } catch (err) {
      console.error('Erro ao cadastrar funcionário:', err);
      res.status(500).render('funcionarios/form', { // Re-renderizar form com erro
        title: 'Novo Funcionário',
        funcionario: funcionarioData,
        errors: [{ msg: 'Erro interno ao salvar o funcionário. Tente novamente.' }],
        isNew: true
      });
    }
});

// Exibir detalhes do funcionário
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const id = req.params.id;
    
    // Buscar dados usando o Model em paralelo
    const [funcionario, trabalhos, adiantamentos, totais] = await Promise.all([
      Funcionario.getById(id),
      Funcionario.getTrabalhos(id),
      Funcionario.getAdiantamentos(id),
      Funcionario.calcularTotais(id) // Usar o novo método para calcular totais
    ]);
    
    if (!funcionario) {
      req.flash('error_msg', 'Funcionário não encontrado.');
      return res.redirect('/funcionarios');
    }
    
    res.render('funcionarios/detalhes', {
      title: `Funcionário: ${funcionario.nome}`,
      funcionario,
      trabalhos,
      adiantamentos,
      totais,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('Erro ao exibir detalhes do funcionário:', err);
    req.flash('error_msg', 'Não foi possível carregar os detalhes do funcionário.');
    res.redirect('/funcionarios');
  }
});

// Formulário para editar funcionário
router.get('/:id/editar', isAuthenticated, async (req, res) => {
  try {
    const id = req.params.id;
    const funcionario = await Funcionario.getById(id); // Usar Model
    
    if (!funcionario) {
      req.flash('error_msg', 'Funcionário não encontrado.');
      return res.redirect('/funcionarios');
    }
    
    res.render('funcionarios/form', { 
      title: `Editar: ${funcionario.nome}`,
      funcionario,
      errors: [],
      isNew: false
    });
  } catch (err) {
    console.error('Erro ao carregar formulário de edição:', err);
    req.flash('error_msg', 'Não foi possível carregar o formulário de edição.');
    res.redirect(`/funcionarios/${req.params.id}`);
  }
});

// Atualizar funcionário
router.put('/:id', 
  isAuthenticated, 
  funcionarioValidationRules(), // Aplicar validação
  async (req, res) => {
    const id = req.params.id;
    const errors = validationResult(req);
    const funcionarioData = req.body;

    if (!errors.isEmpty()) {
      // Adiciona o ID aos dados para re-renderizar o form de edição corretamente
      funcionarioData.id = id; 
      return res.status(400).render('funcionarios/form', {
        title: `Editar: ${funcionarioData.nome || 'Funcionário'}`,
        funcionario: funcionarioData,
        errors: errors.array(),
        isNew: false
      });
    }

    try {
      const result = await Funcionario.update(id, funcionarioData); // Usar Model
      
      if (result.changes === 0 && result.rowCount === 0) { // Verificar se algo foi atualizado (rowCount para pg)
        req.flash('error_msg', 'Funcionário não encontrado ou nenhum dado alterado.');
      } else {
        req.flash('success_msg', `Funcionário ${funcionarioData.nome} atualizado com sucesso!`);
      }
      res.redirect(`/funcionarios/${id}`);
    } catch (err) {
      console.error('Erro ao atualizar funcionário:', err);
      funcionarioData.id = id;
      res.status(500).render('funcionarios/form', { // Re-renderizar form com erro
        title: `Editar: ${funcionarioData.nome || 'Funcionário'}`,
        funcionario: funcionarioData,
        errors: [{ msg: 'Erro interno ao atualizar o funcionário. Tente novamente.' }],
        isNew: false
      });
    }
});

// Validação para adiantamento
const adiantamentoValidationRules = () => {
  return [
    body('valor').isFloat({ gt: 0 }).withMessage('Valor do adiantamento deve ser um número positivo').toFloat(),
    body('data').isISO8601().toDate().withMessage('Data inválida'),
    body('descricao').optional({ checkFalsy: true }).trim().escape()
  ];
};

// Rota para registrar novo adiantamento
router.post('/:id/adiantamento', 
  isAuthenticated, 
  adiantamentoValidationRules(), // Aplicar validação
  async (req, res) => {
    const funcionario_id = req.params.id;
    const errors = validationResult(req);
    const adiantamentoData = { ...req.body, funcionario_id };

    if (!errors.isEmpty()) {
      // Se a validação falhar, redirecionar de volta com erro
      // Idealmente, re-renderizaria a página de detalhes com o erro no modal/form
      // Mas para simplificar, usamos flash message
      req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
      return res.redirect(`/funcionarios/${funcionario_id}`);
    }

    try {
      await Funcionario.registrarAdiantamento(adiantamentoData); // Usar Model
      req.flash('success_msg', `Adiantamento registrado com sucesso!`);
      res.redirect(`/funcionarios/${funcionario_id}`);
    } catch (err) {
      console.error('Erro ao registrar adiantamento:', err);
      req.flash('error_msg', 'Não foi possível registrar o adiantamento.');
      res.redirect(`/funcionarios/${funcionario_id}`);
    }
});

module.exports = router;