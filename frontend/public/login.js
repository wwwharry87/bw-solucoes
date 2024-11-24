let usuarioValido = false;

function fazerLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMessage = document.getElementById('error-message');
    const passwordGroup = document.getElementById('password-group');
    const loginBtn = document.getElementById('login-btn');

    if (!usuarioValido) {
        // Primeira etapa: verificar o usuário
        fetch('/api/verificar-usuario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) { // Corrigido para verificar 'success'
                usuarioValido = true;
                passwordGroup.style.display = 'block';
                loginBtn.textContent = 'Entrar';
                errorMessage.style.display = 'none'; // Esconde a mensagem de erro
            } else {
                errorMessage.textContent = data.message || 'Usuário não encontrado.';
                errorMessage.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Erro ao verificar usuário:', error);
            errorMessage.textContent = 'Erro ao processar a solicitação. Tente novamente.';
            errorMessage.style.display = 'block';
        });
    } else {
        // Segunda etapa: verificar a senha
        fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = data.redirecionar;
            } else {
                errorMessage.textContent = data.message || 'Senha inválida.';
                errorMessage.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Erro ao fazer login:', error);
            errorMessage.textContent = 'Erro ao processar a solicitação. Tente novamente.';
            errorMessage.style.display = 'block';
        });
    }
}

function abrirTelaRedefinicao() {
    window.location.href = "/redefinir.html";
}
