const fs = require('fs');
const bcrypt = require('bcryptjs');

// Função para carregar os dados do arquivo usuario.txt
function carregarUsuarios() {
    const usuarios = [];
    const arquivoPath = 'data/usuario.txt';  // Caminho do arquivo original

    const data = fs.readFileSync(arquivoPath, 'utf-8');
    const linhas = data.split('\n');

    // Ignorar o cabeçalho
    linhas.forEach((linha, index) => {
        if (index === 0) return; // Ignorar cabeçalho
        const [nome, dataNascimento, usuario, senha, telefone] = linha.split(',');

        // Criptografar a senha
        const senhaCriptografada = bcrypt.hashSync(senha, 10);  // Ajuste o número 10 para o número de "salt rounds" que você deseja

        // Adiciona o usuário com a senha criptografada
        usuarios.push({
            nome,
            dataNascimento,
            usuario,
            senha: senhaCriptografada,
            telefone
        });
    });

    return usuarios;
}

// Função para gerar o arquivo com as senhas criptografadas
function gerarArquivoCriptografado() {
    const usuarios = carregarUsuarios();

    // Gera o conteúdo do arquivo com as senhas criptografadas
    let conteudo = 'Nome,DataNascimento,Usuario,Senha,Telefone\n';

    usuarios.forEach(usuario => {
        conteudo += `${usuario.nome},${usuario.dataNascimento},${usuario.usuario},${usuario.senha},${usuario.telefone}\n`;
    });

    // Escreve o conteúdo no arquivo user_encrypted.txt
    fs.writeFileSync('data/user_encrypted.txt', conteudo);
    console.log('Arquivo criptografado gerado com sucesso!');
}

// Chama a função para gerar o arquivo criptografado
gerarArquivoCriptografado();
