let clientReady = false;
let dadosCompletos = []; // Variável para armazenar todos os dados do CSV

window.onload = function () {
    verificarStatusWhatsapp();
    carregarMunicipios();
};

function verificarStatusWhatsapp() {
    const statusIndicator = document.getElementById('whatsapp-status');
    fetch('/api/check-whatsapp')
        .then(response => response.json())
        .then(data => {
            // Agora a resposta tem `connected` e `qr`
            clientReady = data.connected;
            statusIndicator.style.color = clientReady ? '#28a745' : '#ff0000';

            // Se não estiver conectado, mostra o QR Code
            if (!clientReady && data.qr) {
                abrirModal(data.qr); // Exibe a modal com o QR code se não estiver conectado
            }
        })
        .catch(error => console.error('Erro ao verificar WhatsApp:', error));
}

function abrirModal(qrCode) {
    const modal = document.getElementById('modal');
    const overlay = document.getElementById('overlay');
    const qrCodeElement = document.getElementById('qr-code');

    modal.classList.remove('hidden');
    modal.classList.add('show');
    overlay.classList.remove('hidden');
    overlay.classList.add('show');

    qrCodeElement.innerHTML = `<img src="${qrCode}" alt="QR Code">`;
}

function fecharModal() {
    const modal = document.getElementById('modal');
    const overlay = document.getElementById('overlay');

    modal.classList.add('hidden');
    modal.classList.remove('show');
    overlay.classList.add('hidden');
    overlay.classList.remove('show');
}

function carregarMunicipios() {
    const municipioSelect = document.getElementById('municipio');
    fetch('/api/municipios')
        .then(response => response.json())
        .then(municipios => {
            municipios.forEach(municipio => {
                const option = document.createElement('option');
                option.value = municipio.nome;
                option.textContent = municipio.nome;
                municipioSelect.appendChild(option);
            });
        })
        .catch(error => console.error('Erro ao carregar municípios:', error));
}

function trocarMunicipio() {
    const municipioSelect = document.getElementById('municipio');
    const selectedMunicipio = municipioSelect.value;

    if (!selectedMunicipio) return;

    fetch(`/api/dados-csv?municipio=${encodeURIComponent(selectedMunicipio)}&tipo=1`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data)) {
                throw new TypeError('Resposta não é uma lista.');
            }
            dadosCompletos = data; // Armazena todos os dados do CSV
            atualizarTabela(dadosCompletos);
            popularDropdowns(dadosCompletos);
        })
        .catch(error => {
            console.error('Erro ao carregar dados do município:', error);
            alert(`Erro ao carregar dados do município: ${error.message}`);
        });
}

function atualizarTabela(dados) {
    const tabela = document.getElementById('dados-list');
    const enviarBtn = document.getElementById('enviar-btn'); // Botão de envio
    tabela.innerHTML = ''; // Limpa a tabela

    if (dados.length === 0) {
        tabela.innerHTML = '<tr><td colspan="5">Nenhum dado encontrado.</td></tr>';
        enviarBtn.setAttribute('disabled', true); // Desativa o botão
        return;
    }

    enviarBtn.removeAttribute('disabled'); // Habilita o botão se houver dados

    dados.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.turma || '-'}</td>
            <td>${item.professor || '-'}</td>
            <td>${item.disciplina || '-'}</td>
            <td>${item.data || '-'}</td>
            <td>${item.falta || '-'}</td>
        `;
        tabela.appendChild(row);
    });
}

function popularDropdowns(dados) {
    const escolaSelect = document.getElementById('escola');
    const coordenadorSelect = document.getElementById('coordenador');

    const escolas = [...new Set(dados.map(d => d.escola))]; // Remove duplicados
    const coordenadores = [...new Set(dados.map(d => d.coordenador))]; // Remove duplicados

    escolaSelect.innerHTML = '<option value="">Todas as Escolas</option>';
    coordenadorSelect.innerHTML = '<option value="">Todos os Coordenadores</option>';

    escolas.forEach(escola => {
        const option = document.createElement('option');
        option.value = escola;
        option.textContent = escola;
        escolaSelect.appendChild(option);
    });

    coordenadores.forEach(coordenador => {
        const option = document.createElement('option');
        option.value = coordenador;
        option.textContent = coordenador;
        coordenadorSelect.appendChild(option);
    });

    // Adiciona evento para filtrar ao mudar os valores
    escolaSelect.onchange = filtrarTabela;
    coordenadorSelect.onchange = filtrarTabela;
}

function filtrarTabela() {
    const escolaSelect = document.getElementById('escola').value;
    const coordenadorSelect = document.getElementById('coordenador').value;

    const dadosFiltrados = dadosCompletos.filter(item => {
        return (
            (!escolaSelect || item.escola === escolaSelect) &&
            (!coordenadorSelect || item.coordenador === coordenadorSelect)
        );
    });

    atualizarTabela(dadosFiltrados);
}

function enviarMensagem() {
    if (!clientReady) {
        mostrarNotificacao('WhatsApp não está conectado.', 'error');
        return;
    }

    const municipioSelect = document.getElementById('municipio');
    const selectedMunicipio = municipioSelect.value;

    if (!selectedMunicipio) {
        mostrarNotificacao('Selecione um município antes de enviar as mensagens.', 'error');
        return;
    }

    const escolaSelect = document.getElementById('escola').value;
    const coordenadorSelect = document.getElementById('coordenador').value;

    const dadosFiltrados = dadosCompletos.filter(item => {
        return (
            (!escolaSelect || item.escola === escolaSelect) &&
            (!coordenadorSelect || item.coordenador === coordenadorSelect)
        );
    });

    if (dadosFiltrados.length === 0) {
        mostrarNotificacao('Nenhum dado encontrado para envio.', 'error');
        return;
    }

    iniciarProgresso(); // Mostra a barra de progresso

    fetch('/api/coordinforma/send-messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            municipio: selectedMunicipio,
            dados: dadosFiltrados,
        }),
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(() => {
            mostrarNotificacao('Mensagens enviadas com sucesso!', 'success');
        })
        .catch(error => {
            console.error('Erro ao enviar mensagens:', error);
            mostrarNotificacao('Erro ao enviar mensagens.', 'error');
        })
        .finally(() => finalizarProgresso());
}

function iniciarProgresso() {
    const progressBarContainer = document.getElementById('progress-bar');
    const progressBar = progressBarContainer.querySelector('.progress');
    const enviarBtn = document.getElementById('enviar-btn');

    enviarBtn.style.display = 'none';
    progressBarContainer.style.display = 'block';
    let width = 0;

    const interval = setInterval(() => {
        if (width >= 100) {
            clearInterval(interval);
        } else {
            width++;
            progressBar.style.width = `${width}%`;
        }
    }, 30); // Velocidade do progresso
}

function finalizarProgresso() {
    const progressBarContainer = document.getElementById('progress-bar');
    const progressBar = progressBarContainer.querySelector('.progress');
    const enviarBtn = document.getElementById('enviar-btn');

    setTimeout(() => {
        progressBarContainer.style.display = 'none';
        progressBar.style.width = '0%';
        enviarBtn.style.display = 'flex';
    }, 500);
}

function mostrarNotificacao(mensagem, tipo) {
    const notificacao = document.getElementById('notification');
    notificacao.textContent = mensagem;
    notificacao.className = `notification ${tipo} show`;
    setTimeout(() => notificacao.classList.remove('show'), 4000);
}
