const express = require('express');
const router = express.Router();
const db = require('../config/database');

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
    const funcionarios = await db.all('SELECT * FROM funcionarios ORDER BY nome ASC');
    
    res.render('funcionarios/index', { 
      title: 'Funcionários', 
      funcionarios 
    });
  } catch (err) {
    console.error('Erro ao listar funcionários:', err);
    res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Não foi possível carregar a lista de funcionários', 
      error: err 
    });
  }
});

// Formulário para cadastrar novo funcionário
router.get('/novo', isAuthenticated, (req, res) => {
  res.render('funcionarios/form', { 
    title: 'Novo Funcionário',
    funcionario: {},
    isNew: true
  });
});

// Cadastrar novo funcionário
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const {
      nome,
      contato,
      funcao,
      valor_diaria,
      valor_hora_extra,
      valor_empreitada,
      observacoes
    } = req.body;
    
    const result = await db.run(
      `INSERT INTO funcionarios 
       (nome, contato, funcao, valor_diaria, valor_hora_extra, valor_empreitada, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nome, contato, funcao, valor_diaria, valor_hora_extra, valor_empreitada, observacoes]
    );
    
    req.session.flashMessage = {
      type: 'success',
      text: `Funcionário ${nome} cadastrado com sucesso!`
    };
    
    res.redirect('/funcionarios');
  } catch (err) {
    console.error('Erro ao cadastrar funcionário:', err);
    res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Não foi possível cadastrar o funcionário', 
      error: err 
    });
  }
});

// Exibir detalhes do funcionário
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const id = req.params.id;
    
    // Buscar dados do funcionário
    const funcionario = await db.get('SELECT * FROM funcionarios WHERE id = ?', [id]);
    
    if (!funcionario) {
      return res.status(404).render('error', {
        title: 'Não encontrado',
        message: 'Funcionário não encontrado'
      });
    }
    
    // Buscar trabalhos do funcionário
    const trabalhos = await db.all(`
      SELECT t.*, p.nome as projeto_nome 
      FROM trabalhos t 
      JOIN projetos p ON t.projeto_id = p.id 
      WHERE t.funcionario_id = ? 
      ORDER BY t.data DESC
      LIMIT 10`, [id]);
    
    // Buscar adiantamentos do funcionário
    const adiantamentos = await db.all(`
      SELECT * FROM adiantamentos 
      WHERE funcionario_id = ? 
      ORDER BY data DESC
      LIMIT 10`, [id]);
    
    // Calcular totais
    const totais = await db.get(`
      SELECT 
        SUM(t.dias_trabalhados * f.valor_diaria) as total_ganho,
        SUM(t.horas_extras * f.valor_hora_extra) as total_extras,
        (SELECT SUM(valor) FROM adiantamentos WHERE funcionario_id = ?) as total_adiantamentos
      FROM trabalhos t
      JOIN funcionarios f ON t.funcionario_id = f.id
      WHERE t.funcionario_id = ?`, [id, id]);
    
    res.render('funcionarios/detalhes', {
      title: `Funcionário: ${funcionario.nome}`,
      funcionario,
      trabalhos,
      adiantamentos,
      totais
    });
  } catch (err) {
    console.error('Erro ao exibir detalhes do funcionário:', err);
    res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Não foi possível carregar os detalhes do funcionário', 
      error: err 
    });
  }
});

// Formulário para editar funcionário
router.get('/:id/editar', isAuthenticated, async (req, res) => {
  try {
    const id = req.params.id;
    const funcionario = await db.get('SELECT * FROM funcionarios WHERE id = ?', [id]);
    
    if (!funcionario) {
      return res.status(404).render('error', {
        title: 'Não encontrado',
        message: 'Funcionário não encontrado'
      });
    }
    
    res.render('funcionarios/form', { 
      title: `Editar: ${funcionario.nome}`,
      funcionario,
      isNew: false
    });
  } catch (err) {
    console.error('Erro ao carregar formulário de edição:', err);
    res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Não foi possível carregar o formulário de edição', 
      error: err 
    });
  }
});

// Atualizar funcionário
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const id = req.params.id;
    const {
      nome,
      contato,
      funcao,
      valor_diaria,
      valor_hora_extra,
      valor_empreitada,
      status,
      observacoes
    } = req.body;
    
    await db.run(
      `UPDATE funcionarios SET 
        nome = ?,
        contato = ?,
        funcao = ?,
        valor_diaria = ?,
        valor_hora_extra = ?,
        valor_empreitada = ?,
        status = ?,
        observacoes = ?,
        data_atualizacao = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nome, contato, funcao, valor_diaria, valor_hora_extra, valor_empreitada, 
       status, observacoes, id]
    );
    
    req.session.flashMessage = {
      type: 'success',
      text: `Funcionário ${nome} atualizado com sucesso!`
    };
    
    res.redirect(`/funcionarios/${id}`);
  } catch (err) {
    console.error('Erro ao atualizar funcionário:', err);
    res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Não foi possível atualizar o funcionário', 
      error: err 
    });
  }
});

// Rota para registrar novo adiantamento
router.post('/:id/adiantamento', isAuthenticated, async (req, res) => {
  try {
    const funcionario_id = req.params.id;
    const { valor, data, descricao } = req.body;
    
    await db.run(
      'INSERT INTO adiantamentos (funcionario_id, valor, data, descricao) VALUES (?, ?, ?, ?)',
      [funcionario_id, valor, data, descricao]
    );
    
    req.session.flashMessage = {
      type: 'success',
      text: `Adiantamento registrado com sucesso!`
    };
    
    res.redirect(`/funcionarios/${funcionario_id}`);
  } catch (err) {
    console.error('Erro ao registrar adiantamento:', err);
    res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Não foi possível registrar o adiantamento', 
      error: err 
    });
  }
});

module.exports = router;