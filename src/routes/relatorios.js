const express = require('express');
const router = express.Router();
const Relatorio = require('../models/Relatorio');
const Cliente = require('../models/Cliente');
const Funcionario = require('../models/Funcionario');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { generateCSV } = require('../utils/csvUtils');

// Middleware para verificar se usuário está autenticado
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/auth/login');
  }
};

// Página principal de relatórios
router.get('/', isAuthenticated, (req, res) => {
  res.render('relatorios/index', {
    title: 'Relatórios'
  });
});

// Relatório de lucratividade por projeto
router.get('/lucratividade', isAuthenticated, async (req, res) => {
  const { status, data_inicio, data_fim, cliente_id, formato } = req.query;
  
  try {
    // Buscar todos os clientes para o filtro
    const clientes = await Cliente.getAll();
    
    // Filtros para a busca
    const filtros = {
      status: status || '',
      dataInicio: data_inicio || '',
      dataFim: data_fim || '',
      clienteId: cliente_id || ''
    };
    
    // Se não há filtros, mostra apenas o formulário
    if (!status && !data_inicio && !data_fim && !cliente_id) {
      return res.render('relatorios/lucratividade', {
        title: 'Relatório de Lucratividade',
        clientes,
        projetos: null,
        filtros
      });
    }
    
    // Buscar dados com base nos filtros
    const projetos = await Relatorio.getLucratividadePorProjeto(filtros);
    
    // Verificar se é para exportar em CSV
    if (formato === 'csv' && projetos && projetos.length > 0) {
      const { headers, rows } = Relatorio.formatarDadosCSVLucratividade(projetos);
      const csvContent = generateCSV(headers, rows);
      
      // Configurar headers para download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=lucratividade_${Date.now()}.csv`);
      
      // Enviar conteúdo CSV
      return res.send(csvContent);
    }
    
    res.render('relatorios/lucratividade', {
      title: 'Relatório de Lucratividade',
      clientes,
      projetos,
      filtros
    });
  } catch (err) {
    console.error('Erro ao buscar dados de lucratividade:', err);
    return res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao gerar relatório de lucratividade'
    });
  }
});

// Relatório de custos por categoria
router.get('/custos', isAuthenticated, async (req, res) => {
  const { projeto_id, data_inicio, data_fim, formato } = req.query;
  
  // Filtros para a busca
  const filtros = {
    projetoId: projeto_id || '',
    dataInicio: data_inicio || '',
    dataFim: data_fim || ''
  };
  
  // Se não há filtros, mostra apenas o formulário
  if (!projeto_id && !data_inicio && !data_fim) {
    return res.render('relatorios/custos', {
      title: 'Relatório de Custos por Categoria',
      gastos: null,
      filtros
    });
  }
  
  try {
    // Buscar dados com base nos filtros
    const gastos = await Relatorio.getCustosPorCategoria(filtros);
    
    // Verificar se é para exportar em CSV
    if (formato === 'csv' && gastos && gastos.length > 0) {
      const { headers, rows } = Relatorio.formatarDadosCSVCustosPorCategoria(gastos);
      const csvContent = generateCSV(headers, rows);
      
      // Configurar headers para download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=custos_${Date.now()}.csv`);
      
      // Enviar conteúdo CSV
      return res.send(csvContent);
    }
    
    res.render('relatorios/custos', {
      title: 'Relatório de Custos por Categoria',
      gastos,
      filtros
    });
  } catch (err) {
    console.error('Erro ao buscar dados de custos:', err);
    return res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao gerar relatório de custos'
    });
  }
});

// Relatório de pagamento de funcionários
router.get('/pagamentos', isAuthenticated, async (req, res) => {
  const { funcionario_id, data_inicio, data_fim, formato } = req.query;
  
  try {
    // Buscar todos os funcionários para o filtro
    const funcionarios = await Funcionario.getAll();
    
    // Filtros para a busca
    const filtros = {
      funcionarioId: funcionario_id || '',
      dataInicio: data_inicio || '',
      dataFim: data_fim || ''
    };
    
    // Se não há filtros completos, mostra apenas o formulário
    if (!data_inicio || !data_fim) {
      return res.render('relatorios/pagamentos', {
        title: 'Relatório de Pagamentos',
        funcionarios,
        pagamentos: null,
        filtros
      });
    }
    
    // Buscar dados com base nos filtros
    const pagamentos = await Relatorio.getPagamentoFuncionarios(filtros);
    
    // Verificar se é para exportar em CSV
    if (formato === 'csv' && pagamentos && pagamentos.length > 0) {
      const { headers, rows } = Relatorio.formatarDadosCSVPagamentos(pagamentos);
      const csvContent = generateCSV(headers, rows);
      
      // Configurar headers para download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=pagamentos_${Date.now()}.csv`);
      
      // Enviar conteúdo CSV
      return res.send(csvContent);
    }
    
    res.render('relatorios/pagamentos', {
      title: 'Relatório de Pagamentos',
      funcionarios,
      pagamentos,
      filtros
    });
  } catch (err) {
    console.error('Erro ao buscar dados de pagamentos:', err);
    return res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao gerar relatório de pagamentos'
    });
  }
});

// Relatório detalhado de um projeto específico
router.get('/projeto/:id', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  
  try {
    const projeto = await Relatorio.getResumoProjeto(id);
    
    if (!projeto) {
      return res.status(404).render('error', { 
        title: 'Erro', 
        message: 'Projeto não encontrado ou erro ao gerar relatório'
      });
    }
    
    res.render('relatorios/projeto', {
      title: `Relatório - ${projeto.nome}`,
      projeto
    });
  } catch (err) {
    console.error('Erro ao buscar resumo do projeto:', err);
    return res.status(404).render('error', { 
      title: 'Erro', 
      message: 'Projeto não encontrado ou erro ao gerar relatório'
    });
  }
});

// Gerar PDF de um projeto
router.get('/projeto/:id/pdf', isAuthenticated, async (req, res) => {
  const id = req.params.id;
  
  try {
    const projeto = await Relatorio.getResumoProjeto(id);
    
    if (!projeto) {
      return res.status(404).render('error', { 
        title: 'Erro', 
        message: 'Projeto não encontrado ou erro ao gerar relatório'
      });
    }
    
    // Criar diretório de PDFs se não existir
    const pdfDir = path.join(__dirname, '../../src/public/downloads');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }
    
    // Nome do arquivo PDF
    const filename = `projeto_${id}_${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, filename);
    
    // Criar documento PDF
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    
    // Pipe para arquivo
    doc.pipe(stream);
    
    // Cabeçalho
    doc.fontSize(25).text('Relatório de Projeto', {
      align: 'center'
    });
    
    doc.moveDown();
    doc.fontSize(16).text(`${projeto.nome}`, {
      align: 'center'
    });
    
    doc.moveDown();
    doc.fontSize(12).text(`Data do relatório: ${new Date().toLocaleDateString('pt-BR')}`);
    
    // Informações do projeto
    doc.moveDown();
    doc.fontSize(14).text('Informações do Projeto');
    doc.moveDown();
    
    doc.fontSize(10).text(`Cliente: ${projeto.cliente_nome || 'N/A'}`);
    doc.fontSize(10).text(`Contato: ${projeto.cliente_contato || 'N/A'}`);
    doc.fontSize(10).text(`Tipo: ${projeto.tipo}`);
    doc.fontSize(10).text(`Localidade: ${projeto.localidade}`);
    doc.fontSize(10).text(`Status: ${projeto.status === 'em_andamento' ? 'Em Andamento' : 'Concluído'}`);
    doc.fontSize(10).text(`Data de início: ${new Date(projeto.data_inicio).toLocaleDateString('pt-BR')}`);
    doc.fontSize(10).text(`Data prevista para conclusão: ${new Date(projeto.data_fim_prevista).toLocaleDateString('pt-BR')}`);
    
    if (projeto.data_fim_real) {
      doc.fontSize(10).text(`Data de conclusão: ${new Date(projeto.data_fim_real).toLocaleDateString('pt-BR')}`);
    }
    
    doc.fontSize(10).text(`Valor total do projeto: R$ ${projeto.valor_receber.toFixed(2)}`);
    doc.fontSize(10).text(`Deslocamento incluído: ${projeto.deslocamento_incluido ? 'Sim' : 'Não'}`);
    
    // Resumo financeiro
    doc.moveDown();
    doc.fontSize(14).text('Resumo Financeiro');
    doc.moveDown();
    
    doc.fontSize(10).text(`Receita total: R$ ${projeto.valor_receber.toFixed(2)}`);
    doc.fontSize(10).text(`Total de gastos com materiais: R$ ${projeto.total_gastos.toFixed(2)}`);
    doc.fontSize(10).text(`Total de custos com mão de obra: R$ ${projeto.custo_mao_obra.toFixed(2)}`);
    doc.fontSize(10).text(`Lucro líquido: R$ ${projeto.lucro_liquido.toFixed(2)}`);
    doc.fontSize(10).text(`Margem de lucro: ${((projeto.lucro_liquido / projeto.valor_receber) * 100).toFixed(2)}%`);
    
    // Gastos por categoria
    if (projeto.gastosPorCategoria && projeto.gastosPorCategoria.length > 0) {
      doc.moveDown();
      doc.fontSize(14).text('Gastos por Categoria');
      doc.moveDown();
      
      projeto.gastosPorCategoria.forEach(gasto => {
        doc.fontSize(10).text(`${gasto.categoria}: R$ ${gasto.total.toFixed(2)}`);
      });
    }
    
    // Funcionários
    if (projeto.funcionarios && projeto.funcionarios.length > 0) {
      doc.moveDown();
      doc.fontSize(14).text('Mão de Obra');
      doc.moveDown();
      
      projeto.funcionarios.forEach(func => {
        doc.fontSize(10).text(`${func.nome} (${func.funcao}): R$ ${func.valor_total.toFixed(2)}`);
      });
    }
    
    // Prazo
    doc.moveDown();
    doc.fontSize(14).text('Análise de Prazo');
    doc.moveDown();
    
    const diasPrevistos = projeto.dias_previstos;
    const diasDuracao = projeto.dias_duracao;
    
    doc.fontSize(10).text(`Dias previstos: ${Math.round(diasPrevistos)}`);
    doc.fontSize(10).text(`Dias trabalhados: ${Math.round(diasDuracao)}`);
    
    if (projeto.status === 'concluido') {
      const variacao = ((diasDuracao - diasPrevistos) / diasPrevistos) * 100;
      doc.fontSize(10).text(`Variação de prazo: ${variacao > 0 ? '+' : ''}${variacao.toFixed(2)}%`);
    } else {
      const progresso = (diasDuracao / diasPrevistos) * 100;
      doc.fontSize(10).text(`Progresso: ${progresso.toFixed(2)}%`);
    }
    
    // Finalizar
    doc.end();
    
    // Aguardar a finalização da geração do PDF
    stream.on('finish', () => {
      // Enviar arquivo como download
      const downloadUrl = `/downloads/${filename}`;
      res.render('relatorios/download', {
        title: 'Download de Relatório',
        downloadUrl,
        projetoNome: projeto.nome
      });
    });
  } catch (err) {
    console.error('Erro ao gerar PDF do projeto:', err);
    return res.status(500).render('error', { 
      title: 'Erro', 
      message: 'Erro ao gerar PDF do relatório'
    });
  }
});

module.exports = router;