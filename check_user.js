// Script para verificar os dados da tabela users
const { supabase } = require('./src/config/supabase');
const db = require('./src/config/database');
const bcrypt = require('bcrypt');

async function checkUsers() {
  console.log('Verificando usuários no Supabase...');
  
  try {
    // Verificar usuários existentes no Supabase
    const { data: supabaseUsers, error } = await supabase.from('users').select('*');
    
    if (error) throw error;
    
    console.log('Usuários encontrados no Supabase:', supabaseUsers?.length || 0);
    if (supabaseUsers && supabaseUsers.length > 0) {
      console.log('Amostra de dados:');
      console.log(JSON.stringify(supabaseUsers[0], null, 2));
    } else {
      console.log('Nenhum usuário encontrado na tabela users');
    }
    
    // Se não tiver usuários, criar um usuário de teste
    if (!supabaseUsers || supabaseUsers.length === 0) {
      console.log('Criando usuário de teste...');
      const senhaCriptografada = await bcrypt.hash('123456', 10);
      
      const { data: novoUsuario, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            nome: 'Usuário Teste',
            email: 'teste@exemplo.com',
            senha: senhaCriptografada,
            role: 'usuario'
          }
        ])
        .select();
      
      if (insertError) {
        console.error('Erro ao criar usuário:', insertError.message);
      } else {
        console.log('Usuário de teste criado com sucesso!');
        console.log('Email: teste@exemplo.com');
        console.log('Senha: 123456');
      }
    }
    
    // Verificar se a função promiseGet está funcionando corretamente
    console.log('\nTestando função db.promiseGet...');
    const testEmail = 'teste@exemplo.com';
    const user = await db.promiseGet('SELECT * FROM users WHERE email = ?', [testEmail]);
    
    if (user) {
      console.log(`Usuário '${testEmail}' encontrado via db.promiseGet!`);
      console.log('ID:', user.id);
      console.log('Nome:', user.nome);
      console.log('Email:', user.email);
      console.log('Role:', user.role);
    } else {
      console.log(`Usuário '${testEmail}' NÃO encontrado via db.promiseGet`);
      console.log('Isso indica um problema na função promiseGet ou na conexão com o banco');
    }
  } catch (err) {
    console.error('Erro ao verificar usuários:', err);
  }
}

checkUsers().then(() => {
  console.log('Verificação concluída');
  process.exit(0);
}).catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});