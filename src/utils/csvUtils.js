// Utilitário para geração de arquivos CSV

/**
 * Gera conteúdo CSV a partir de cabeçalhos e linhas de dados
 * @param {Array<string>} headers - Cabeçalhos das colunas
 * @param {Array<Array<string|number>>} rows - Linhas de dados
 * @returns {string} - Conteúdo CSV formatado
 */
function generateCSV(headers, rows) {
  // Linha de cabeçalhos
  const headerLine = headers.join(',');
  
  // Processar linhas
  const dataLines = rows.map(row => {
    return row.map(cell => {
      // Se o conteúdo contiver vírgulas, aspas ou quebras de linha,
      // colocamos entre aspas duplas e escapamos aspas internas
      if (typeof cell === 'string' && 
          (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',');
  });
  
  // Juntar cabeçalho e linhas com quebras de linha
  return [headerLine, ...dataLines].join('\r\n');
}

module.exports = {
  generateCSV
};