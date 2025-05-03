// Script para testar a verificação de senha
const bcrypt = require('bcrypt');
const { supabase } = require('./src/config/supabase');

// Função para testar se a senha é válida
async function testPassword(email, senha) {
  try {
    console.log(`Testando login para: ${email}`);
    console.log('Buscando usuário no Supabase...');
    
    // Buscar usuário diretamente no Supabase
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);
    
    if (error) {
      console.error('Erro ao buscar usuário:', error.message);
      return;
    }
    
    if (!users || users.length === 0) {
      console.log('Usuário não encontrado.');
      return;
    }
    
    const user = users[0];
    console.log('Usuário encontrado:');
    console.log('ID:', user.id);
    console.log('Nome:', user.nome);
    console.log('Email:', user.email);
    console.log('Hash da senha armazenada:', user.senha);
    
    // Testar a senha
    console.log('\nVerificando senha...');
    const senhaValida = await bcrypt.compare(senha, user.senha);
    
    console.log('Resultado da verificação:', senhaValida ? 'VÁLIDA ✓' : 'INVÁLIDA ✗');
    
    if (!senhaValida) {
      console.log('\nDiagnóstico de possíveis problemas:');
      console.log('1. A senha digitada pode estar incorreta');
      console.log('2. O hash da senha no banco pode estar corrompido ou usar uma configuração diferente de bcrypt');
      console.log('3. Pode haver um problema com a biblioteca bcrypt');
      
      // Gerar um novo hash da senha fornecida para comparação
      const novoHash = await bcrypt.hash(senha, 10);
      console.log('\nNovo hash gerado para a mesma senha:', novoHash);
      console.log('(Compare com o hash armazenado para verificar diferenças)');
    }
    
    return senhaValida;
  } catch (err) {
    console.error('Erro ao testar senha:', err);
  }
}

// Definir a senha para testar (substitua pela sua senha real quando executar o script)
const testEmail = process.argv[2] || 'matheus.meira.felippe@gmail.com';
const testSenha = process.argv[3] || '123456'; // Senha padrão para teste

testPassword(testEmail, testSenha).then(() => {
  console.log('\nTeste concluído!');
  process.exit(0);
}).catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});