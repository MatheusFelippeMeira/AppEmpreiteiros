const express = require('express');
const router = express.Router();
const Cliente = require('../models/Cliente');
const Orcamento = require('../models/Orcamento');
const IA = require('../models/IA');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');

// Middleware para verificar se usuário está autenticado
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/auth/login');
  }
};

// Listar orçamentos
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const orcamentos = await Orcamento.getAll();
    
    res.render('orcamentos/index', {
      title: 'Orçamentos',
      orcamentos
    });
  } catch (err) {
    console.error('Erro ao buscar orçamentos:', err);
    return res.status(500).render('error', {
      title: 'Erro',
      message: 'Erro ao buscar orçamentos'
    });
  }
});

// Formulário para novo orçamento
router.get('/novo', isAuthenticated, async (req, res) => {
  try {
    // Buscar todos os clientes para o formulário
    const clientes = await new Promise((resolve, reject) => {
      Cliente.getAll((err, result) => {
        if (err) reject(err);
        else resolve(result || []);
      });
    });
    
    // Buscar projetos para o formulário
    const projetos = await db.promiseAll('SELECT id, nome FROM projetos ORDER BY nome');
    
    res.render('orcamentos/form', {
      title: 'Novo Orçamento',
      orcamento: {},
      clientes,
      projetos
    });
  } catch (err) {
    console.error('Erro ao preparar formulário:', err);
    return res.status(500).render('error', {
      title: 'Erro',
      message: 'Erro ao carregar formulário'
    });
  }
});

// Formulário para novo orçamento detalhado
router.get('/novo/detalhado', isAuthenticated, async (req, res) => {
  try {
    // Buscar todos os clientes para o formulário
    const clientes = await new Promise((resolve, reject) => {
      Cliente.getAll((err, result) => {
        if (err) reject(err);
        else resolve(result || []);
      });
    });
    
    // Buscar projetos para o formulário
    const projetos = await db.promiseAll('SELECT id, nome FROM projetos ORDER BY nome');
    
    res.render('orcamentos/form_detalhado', {
      title: 'Novo Orçamento Detalhado',
      orcamento: {},
      clientes,
      projetos
    });
  } catch (err) {
    console.error('Erro ao preparar formulário detalhado:', err);
    return res.status(500).render('error', {
      title: 'Erro',
      message: 'Erro ao carregar formulário'
    });
  }
});

// Criar novo orçamento
router.post('/', isAuthenticated, async (req, res) => {
  const { cliente_id, projeto_id, titulo, descricao, valor_total, tipo_obra, localidade, status } = req.body;
  
  // Validação simples
  if (!titulo || !valor_total) {
    try {
      // Buscar todos os clientes novamente para o formulário
      const clientes = await new Promise((resolve, reject) => {
        Cliente.getAll((err, result) => {
          if (err) reject(err);
          else resolve(result || []);
        });
      });
      
      // Buscar projetos para o formulário
      const projetos = await db.promiseAll('SELECT id, nome FROM projetos ORDER BY nome');
      
      return res.status(400).render('orcamentos/form', {
        title: 'Novo Orçamento',
        orcamento: req.body,
        clientes,
        projetos,
        error: 'Título e valor total são obrigatórios'
      });
    } catch (err) {
      console.error('Erro ao recarregar formulário:', err);
      return res.status(500).render('error', {
        title: 'Erro',
        message: 'Erro ao processar formulário'
      });
    }
    return;
  }
  
  try {
    await Orcamento.create({
      cliente_id,
      projeto_id: projeto_id || null,
      titulo,
      descricao,
      valor_total,
      tipo_obra,
      localidade,
      status: status || 'pendente'
    });
    
    res.redirect('/orcamentos');
  } catch (err) {
    console.error('Erro ao criar orçamento:', err);
    
    // Buscar todos os clientes novamente para o formulário
    const clientes = await new Promise((resolve, reject) => {
      Cliente.getAll((err, result) => {
        if (err) reject(err);
        else resolve(result || []);
      });
    });
    
    // Buscar projetos para o formulário
    const projetos = await db.promiseAll('SELECT id, nome FROM projetos ORDER BY nome');
    
    return res.status(500).render('orcamentos/form', {
      title: 'Novo Orçamento',
      orcamento: req.body,
      clientes,
      projetos,
      error: 'Erro ao criar orçamento'
    });
  }
});

// Criar novo orçamento detalhado
router.post('/detalhado', isAuthenticated, async (req, res) => {
  const { 
    cliente_id, projeto_id, titulo, descricao, valor_total, 
    tipo_obra, localidade, status, margem_lucro,
    materiais, mao_obra
  } = req.body;
  
  // Validação simples
  if (!titulo || !valor_total) {
    try {
      // Buscar todos os clientes novamente para o formulário
      const clientes = await new Promise((resolve, reject) => {
        Cliente.getAll((err, result) => {
          if (err) reject(err);
          else resolve(result || []);
        });
      });
      
      // Buscar projetos para o formulário
      const projetos = await db.promiseAll('SELECT id, nome FROM projetos ORDER BY nome');
      
      return res.status(400).render('orcamentos/form_detalhado', {
        title: 'Novo Orçamento Detalhado',
        orcamento: {
          ...req.body,
          itens: { materiais, mao_obra }
        },
        clientes,
        projetos,
        error: 'Título e valor total são obrigatórios'
      });
    } catch (err) {
      console.error('Erro ao recarregar formulário:', err);
      return res.status(500).render('error', {
        title: 'Erro',
        message: 'Erro ao processar formulário'
      });
    }
    return;
  }
  
  try {
    // Criar o orçamento principal
    const result = await Orcamento.create({
      cliente_id,
      projeto_id: projeto_id || null,
      titulo,
      descricao,
      valor_total,
      tipo_obra,
      localidade,
      status: status || 'pendente',
      margem_lucro: margem_lucro || 20
    });
    
    const orcamentoId = result.lastID;
    
    // Salvar itens de materiais
    if (materiais && Array.isArray(materiais)) {
      for (const item of materiais) {
        if (item.descricao && item.valor_unitario) {
          await db.promiseRun(
            `INSERT INTO orcamento_itens (orcamento_id, tipo, descricao, quantidade, valor_unitario)
             VALUES (?, ?, ?, ?, ?)`,
            [orcamentoId, 'material', item.descricao, item.quantidade || 1, item.valor_unitario]
          );
        }
      }
    }
    
    // Salvar itens de mão de obra
    if (mao_obra && Array.isArray(mao_obra)) {
      for (const item of mao_obra) {
        if (item.descricao && item.valor_unitario) {
          await db.promiseRun(
            `INSERT INTO orcamento_itens (orcamento_id, tipo, descricao, quantidade, valor_unitario)
             VALUES (?, ?, ?, ?, ?)`,
            [orcamentoId, 'mao_obra', item.descricao, item.quantidade || 1, item.valor_unitario]
          );
        }
      }
    }
    
    res.redirect(`/orcamentos/${orcamentoId}`);
  } catch (err) {
    console.error('Erro ao criar orçamento detalhado:', err);
    
    // Buscar todos os clientes novamente para o formulário
    const clientes = await new Promise((resolve, reject) => {
      Cliente.getAll((err, result) => {
        if (err) reject(err);
        else resolve(result || []);
      });
    });
    
    // Buscar projetos para o formulário
    const projetos = await db.promiseAll('SELECT id, nome FROM projetos ORDER BY nome');
    
    return res.status(500).render('orcamentos/form_detalhado', {
      title: 'Novo Orçamento Detalhado',
      orcamento: {
        ...req.body,
        itens: { materiais, mao_obra }
      },
      clientes,
      projetos,
      error: 'Erro ao criar orçamento'
    });
  }
});

// Visualizar um orçamento específico
router.get('/:id', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  
  try {
    const orcamento = await Orcamento.getById(id);
    
    if (!orcamento) {
      return res.status(404).render('error', {
        title: 'Erro',
        message: 'Orçamento não encontrado'
      });
    }
    
    // Buscar itens do orçamento se existirem
    const itens = await db.promiseAll(
      `SELECT * FROM orcamento_itens WHERE orcamento_id = ? ORDER BY tipo, id`,
      [id]
    );
    
    // Organizar itens por tipo
    const itensPorTipo = {
      materiais: itens.filter(item => item.tipo === 'material'),
      mao_obra: itens.filter(item => item.tipo === 'mao_obra')
    };
    
    // Adicionar itens ao objeto do orçamento
    orcamento.itens = itensPorTipo;
    
    res.render('orcamentos/detalhes', {
      title: `Orçamento - ${orcamento.titulo}`,
      orcamento
    });
  } catch (err) {
    console.error('Erro ao buscar orçamento:', err);
    return res.status(500).render('error', {
      title: 'Erro',
      message: 'Erro ao buscar orçamento'
    });
  }
});

// Formulário para editar orçamento
router.get('/:id/editar', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  
  try {
    const orcamento = await Orcamento.getById(id);
    
    if (!orcamento) {
      return res.status(404).render('error', {
        title: 'Erro',
        message: 'Orçamento não encontrado'
      });
    }
    
    // Buscar todos os clientes para o formulário
    const clientes = await new Promise((resolve, reject) => {
      Cliente.getAll((err, result) => {
        if (err) reject(err);
        else resolve(result || []);
      });
    });
    
    // Buscar projetos para o formulário
    const projetos = await db.promiseAll('SELECT id, nome FROM projetos ORDER BY nome');
    
    // Verificar se é um orçamento detalhado
    const itens = await db.promiseAll(
      `SELECT * FROM orcamento_itens WHERE orcamento_id = ? ORDER BY tipo, id`,
      [id]
    );
    
    if (itens && itens.length > 0) {
      // Organizar itens por tipo
      const itensPorTipo = {
        materiais: itens.filter(item => item.tipo === 'material'),
        mao_obra: itens.filter(item => item.tipo === 'mao_obra')
      };
      
      // Adicionar itens ao objeto do orçamento
      orcamento.itens = itensPorTipo;
      
      res.render('orcamentos/form_detalhado', {
        title: `Editar - ${orcamento.titulo}`,
        orcamento,
        clientes,
        projetos
      });
    } else {
      res.render('orcamentos/form', {
        title: `Editar - ${orcamento.titulo}`,
        orcamento,
        clientes,
        projetos
      });
    }
  } catch (err) {
    console.error('Erro ao buscar orçamento:', err);
    return res.status(500).render('error', {
      title: 'Erro',
      message: 'Erro ao buscar orçamento'
    });
  }
});

// Atualizar orçamento
router.post('/:id', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  const { cliente_id, projeto_id, titulo, descricao, valor_total, tipo_obra, localidade, status } = req.body;
  
  // Validação simples
  if (!titulo || !valor_total) {
    try {
      // Buscar todos os clientes novamente para o formulário
      const clientes = await new Promise((resolve, reject) => {
        Cliente.getAll((err, result) => {
          if (err) reject(err);
          else resolve(result || []);
        });
      });
      
      // Buscar projetos para o formulário
      const projetos = await db.promiseAll('SELECT id, nome FROM projetos ORDER BY nome');
      
      return res.status(400).render('orcamentos/form', {
        title: 'Editar Orçamento',
        orcamento: { id, ...req.body },
        clientes,
        projetos,
        error: 'Título e valor total são obrigatórios'
      });
    } catch (err) {
      console.error('Erro ao recarregar formulário:', err);
      return res.status(500).render('error', {
        title: 'Erro',
        message: 'Erro ao processar formulário'
      });
    }
    return;
  }
  
  try {
    await Orcamento.update(id, {
      cliente_id,
      projeto_id: projeto_id || null,
      titulo,
      descricao,
      valor_total,
      tipo_obra,
      localidade,
      status
    });
    
    res.redirect(`/orcamentos/${id}`);
  } catch (err) {
    console.error('Erro ao atualizar orçamento:', err);
    
    // Buscar todos os clientes novamente para o formulário
    const clientes = await new Promise((resolve, reject) => {
      Cliente.getAll((err, result) => {
        if (err) reject(err);
        else resolve(result || []);
      });
    });
    
    // Buscar projetos para o formulário
    const projetos = await db.promiseAll('SELECT id, nome FROM projetos ORDER BY nome');
    
    return res.status(500).render('orcamentos/form', {
      title: 'Editar Orçamento',
      orcamento: { id, ...req.body },
      clientes,
      projetos,
      error: 'Erro ao atualizar orçamento'
    });
  }
});

// Atualizar orçamento detalhado
router.post('/:id/detalhado', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  const { 
    cliente_id, projeto_id, titulo, descricao, valor_total, 
    tipo_obra, localidade, status, margem_lucro,
    materiais, mao_obra
  } = req.body;
  
  // Validação simples
  if (!titulo || !valor_total) {
    try {
      // Buscar todos os clientes novamente para o formulário
      const clientes = await new Promise((resolve, reject) => {
        Cliente.getAll((err, result) => {
          if (err) reject(err);
          else resolve(result || []);
        });
      });
      
      // Buscar projetos para o formulário
      const projetos = await db.promiseAll('SELECT id, nome FROM projetos ORDER BY nome');
      
      return res.status(400).render('orcamentos/form_detalhado', {
        title: 'Editar Orçamento',
        orcamento: { 
          id, 
          ...req.body,
          itens: { materiais, mao_obra }
        },
        clientes,
        projetos,
        error: 'Título e valor total são obrigatórios'
      });
    } catch (err) {
      console.error('Erro ao recarregar formulário:', err);
      return res.status(500).render('error', {
        title: 'Erro',
        message: 'Erro ao processar formulário'
      });
    }
    return;
  }
  
  try {
    // Atualizar o orçamento principal
    await Orcamento.update(id, {
      cliente_id,
      projeto_id: projeto_id || null,
      titulo,
      descricao,
      valor_total,
      tipo_obra,
      localidade,
      status,
      margem_lucro: margem_lucro || 20
    });
    
    // Remover itens existentes
    await db.promiseRun('DELETE FROM orcamento_itens WHERE orcamento_id = ?', [id]);
    
    // Salvar itens de materiais
    if (materiais && Array.isArray(materiais)) {
      for (const item of materiais) {
        if (item.descricao && item.valor_unitario) {
          await db.promiseRun(
            `INSERT INTO orcamento_itens (orcamento_id, tipo, descricao, quantidade, valor_unitario)
             VALUES (?, ?, ?, ?, ?)`,
            [id, 'material', item.descricao, item.quantidade || 1, item.valor_unitario]
          );
        }
      }
    }
    
    // Salvar itens de mão de obra
    if (mao_obra && Array.isArray(mao_obra)) {
      for (const item of mao_obra) {
        if (item.descricao && item.valor_unitario) {
          await db.promiseRun(
            `INSERT INTO orcamento_itens (orcamento_id, tipo, descricao, quantidade, valor_unitario)
             VALUES (?, ?, ?, ?, ?)`,
            [id, 'mao_obra', item.descricao, item.quantidade || 1, item.valor_unitario]
          );
        }
      }
    }
    
    res.redirect(`/orcamentos/${id}`);
  } catch (err) {
    console.error('Erro ao atualizar orçamento detalhado:', err);
    
    // Buscar todos os clientes novamente para o formulário
    const clientes = await new Promise((resolve, reject) => {
      Cliente.getAll((err, result) => {
        if (err) reject(err);
        else resolve(result || []);
      });
    });
    
    // Buscar projetos para o formulário
    const projetos = await db.promiseAll('SELECT id, nome FROM projetos ORDER BY nome');
    
    return res.status(500).render('orcamentos/form_detalhado', {
      title: 'Editar Orçamento',
      orcamento: { 
        id, 
        ...req.body,
        itens: { materiais, mao_obra }
      },
      clientes,
      projetos,
      error: 'Erro ao atualizar orçamento'
    });
  }
});

// Excluir orçamento
router.post('/:id/excluir', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  
  try {
    // Remover itens do orçamento primeiro (se existirem)
    await db.promiseRun('DELETE FROM orcamento_itens WHERE orcamento_id = ?', [id]);
    
    // Remover o orçamento
    await Orcamento.delete(id);
    
    res.redirect('/orcamentos');
  } catch (err) {
    console.error('Erro ao excluir orçamento:', err);
    return res.status(500).render('error', {
      title: 'Erro',
      message: 'Erro ao excluir orçamento'
    });
  }
});

// Gerar PDF do orçamento
router.get('/:id/pdf', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  
  try {
    const orcamento = await Orcamento.getById(id);
    
    if (!orcamento) {
      return res.status(404).render('error', {
        title: 'Erro',
        message: 'Orçamento não encontrado'
      });
    }
    
    // Buscar itens do orçamento se existirem
    const itens = await db.promiseAll(
      `SELECT * FROM orcamento_itens WHERE orcamento_id = ? ORDER BY tipo, id`,
      [id]
    );
    
    // Organizar itens por tipo
    const itensPorTipo = {
      materiais: itens.filter(item => item.tipo === 'material'),
      mao_obra: itens.filter(item => item.tipo === 'mao_obra')
    };
    
    // Adicionar itens ao objeto do orçamento
    orcamento.itens = itensPorTipo;
    
    // Renderizar a página de PDF
    res.render('orcamentos/pdf', {
      title: `Orçamento - ${orcamento.titulo}`,
      orcamento,
      layout: false // Sem layout para PDF
    });
  } catch (err) {
    console.error('Erro ao gerar PDF do orçamento:', err);
    return res.status(500).render('error', {
      title: 'Erro',
      message: 'Erro ao gerar PDF'
    });
  }
});

// Formulário para geração de orçamento com IA
router.get('/gerar-ia', isAuthenticated, async (req, res) => {
  // Verificar se existe a chave da API de IA
  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).render('error', {
      title: 'Erro',
      message: 'API de IA não configurada. Adicione uma chave OPENAI_API_KEY no arquivo .env'
    });
  }
  
  try {
    // Buscar todos os clientes para o formulário
    const clientes = await new Promise((resolve, reject) => {
      Cliente.getAll((err, result) => {
        if (err) reject(err);
        else resolve(result || []);
      });
    });
    
    res.render('orcamentos/form_ia', {
      title: 'Gerar Orçamento com IA',
      clientes
    });
  } catch (err) {
    console.error('Erro ao preparar formulário:', err);
    return res.status(500).render('error', {
      title: 'Erro',
      message: 'Erro ao carregar formulário'
    });
  }
});

// Processar geração de orçamento com IA
router.post('/gerar-ia', isAuthenticated, async (req, res) => {
  try {
    const { cliente_id, tipo_obra, localidade, tamanho, descricao } = req.body;
    
    // Verificar se existe a chave da API de IA
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).render('error', {
        title: 'Erro',
        message: 'API de IA não configurada. Adicione uma chave OPENAI_API_KEY no arquivo .env'
      });
    }
    
    // Validação simples
    if (!tipo_obra || !localidade || !tamanho) {
      // Buscar todos os clientes novamente para o formulário
      const clientes = await new Promise((resolve, reject) => {
        Cliente.getAll((err, result) => {
          if (err) reject(err);
          else resolve(result || []);
        });
      });
      
      return res.status(400).render('orcamentos/form_ia', {
        title: 'Gerar Orçamento com IA',
        dados: req.body,
        clientes,
        error: 'Tipo de obra, localidade e tamanho são obrigatórios'
      });
    }
    
    // Gerar orçamento com IA
    const resultado = await IA.gerarOrcamento({
      tipo_obra,
      localidade,
      tamanho,
      descricao: descricao || ''
    });
    
    if (resultado.erro) {
      return res.status(500).render('error', {
        title: 'Erro',
        message: resultado.erro
      });
    }
    
    res.render('orcamentos/resultado_ia', {
      title: 'Orçamento Gerado',
      orcamento: resultado.orcamento,
      dados: resultado.dados,
      cliente_id
    });
    
  } catch (error) {
    console.error('Erro ao gerar orçamento com IA:', error);
    res.status(500).render('error', {
      title: 'Erro',
      message: 'Erro ao gerar orçamento'
    });
  }
});

// Salvar orçamento gerado com IA
router.post('/salvar-orcamento-ia', isAuthenticated, async (req, res) => {
  const { cliente_id, titulo, descricao, valor_total, tipo_obra, localidade } = req.body;
  
  // Validação simples
  if (!titulo || !valor_total) {
    return res.status(400).render('error', {
      title: 'Erro',
      message: 'Título e valor total são obrigatórios'
    });
  }
  
  try {
    const result = await Orcamento.create({
      cliente_id,
      titulo,
      descricao,
      valor_total,
      tipo_obra,
      localidade,
      status: 'pendente'
    });
    
    res.redirect(`/orcamentos/${result.lastID}`);
  } catch (err) {
    console.error('Erro ao salvar orçamento gerado com IA:', err);
    return res.status(500).render('error', {
      title: 'Erro',
      message: 'Erro ao salvar orçamento'
    });
  }
});

module.exports = router;