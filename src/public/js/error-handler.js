/**
 * App Empreiteiros - Tratamento de erros global
 * Este script fornece tratamento de erros avançado para o aplicativo
 */

// Configurar tratamento global de erros
window.addEventListener('error', function(event) {
  console.error('Erro global capturado:', event.error || event.message);
  
  // Evitar loops infinitos de erro
  if (event.message && (
      event.message.includes('localStorage') || 
      event.message.includes('storage') ||
      event.message.includes('Access to storage')
    )) {
    console.warn('Erro de acesso ao storage detectado. Usando modo de compatibilidade.');
    
    // Criar polyfill para localStorage
    if (typeof window.localStorage === 'undefined' || window.localStorage === null) {
      window.localStorage = {
        _data: {},
        setItem: function(id, val) { this._data[id] = String(val); },
        getItem: function(id) { return this._data.hasOwnProperty(id) ? this._data[id] : null; },
        removeItem: function(id) { delete this._data[id]; },
        clear: function() { this._data = {}; }
      };
      console.log('Polyfill para localStorage criado');
    }
    
    // Criar polyfill para sessionStorage
    if (typeof window.sessionStorage === 'undefined' || window.sessionStorage === null) {
      window.sessionStorage = {
        _data: {},
        setItem: function(id, val) { this._data[id] = String(val); },
        getItem: function(id) { return this._data.hasOwnProperty(id) ? this._data[id] : null; },
        removeItem: function(id) { delete this._data[id]; },
        clear: function() { this._data = {}; }
      };
      console.log('Polyfill para sessionStorage criado');
    }
  }
  
  // Tratar erros de sintaxe em scripts
  if (event.message && event.message.includes('Unexpected token')) {
    console.warn('Erro de sintaxe detectado:', event.message);
    
    // Tentar identificar o script com erro
    const scriptUrl = event.filename || 'desconhecido';
    const lineNumber = event.lineno || 'desconhecido';
    const columnNumber = event.colno || 'desconhecido';
    
    console.warn(`Erro em ${scriptUrl}:${lineNumber}:${columnNumber}`);
    
    // Mostrar notificação ao usuário
    if (typeof showNotification === 'function') {
      showNotification('Erro de script detectado. Algumas funcionalidades podem não funcionar corretamente.', 'warning');
    }
  }
  
  // Tratar erros de rede
  if (event.message && (
      event.message.includes('NetworkError') || 
      event.message.includes('Failed to fetch') ||
      event.message.includes('Network request failed')
    )) {
    console.warn('Erro de rede detectado:', event.message);
    
    // Adicionar classe de modo offline ao body
    document.body.classList.add('offline-mode');
    
    // Tentar reconectar após 10 segundos
    setTimeout(function() {
      // Verificar conexão com o servidor
      fetch('/health')
        .then(response => {
          if (!response.ok) {
            throw new Error('Servidor não está respondendo corretamente');
          }
          return response.text();
        })
        .then(data => {
          console.log('Conexão com o servidor restaurada:', data);
          document.body.classList.remove('offline-mode');
          
          // Mostrar notificação ao usuário
          if (typeof showNotification === 'function') {
            showNotification('Conexão com o servidor restaurada.', 'success');
          }
          
          // Recarregar a página após 2 segundos
          setTimeout(function() {
            window.location.reload();
          }, 2000);
        })
        .catch(error => {
          console.error('Erro ao verificar conexão:', error);
          // Tentar novamente após 10 segundos
          setTimeout(arguments.callee, 10000);
        });
    }, 10000);
  }
});

// Adicionar estilos para modo offline
const offlineStyles = document.createElement('style');
offlineStyles.textContent = `
  .offline-mode:before {
    content: "Você está offline. Tentando reconectar...";
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background-color: #f8d7da;
    color: #721c24;
    padding: 10px;
    text-align: center;
    z-index: 9999;
  }
  
  .error-boundary {
    border: 1px solid #f8d7da;
    background-color: #fff3f3;
    padding: 15px;
    border-radius: 5px;
    margin: 10px 0;
  }
  
  .error-boundary h5 {
    color: #721c24;
    margin-top: 0;
  }
`;
document.head.appendChild(offlineStyles);

// Função para criar um limite de erro em torno de um elemento
function createErrorBoundary(element, errorMessage) {
  const boundary = document.createElement('div');
  boundary.className = 'error-boundary';
  
  const title = document.createElement('h5');
  title.textContent = 'Erro ao carregar componente';
  
  const message = document.createElement('p');
  message.textContent = errorMessage || 'Ocorreu um erro ao carregar este componente.';
  
  const retryButton = document.createElement('button');
  retryButton.className = 'btn btn-sm btn-outline-danger';
  retryButton.textContent = 'Tentar novamente';
  retryButton.addEventListener('click', function() {
    window.location.reload();
  });
  
  boundary.appendChild(title);
  boundary.appendChild(message);
  boundary.appendChild(retryButton);
  
  // Substituir o elemento original pelo limite de erro
  if (element.parentNode) {
    element.parentNode.replaceChild(boundary, element);
  }
  
  return boundary;
}

// Exportar funções úteis
window.errorHandler = {
  createErrorBoundary: createErrorBoundary
};