let dadosCompletos = []; // Variável para armazenar todos os dados do CSV
let clientReady = false; // Status do WhatsApp

window.onload = function () {
    verificarStatusWhatsapp();
    carregarMunicipios();
};

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

    fetch(`/api/dados-csv?municipio=${encodeURIComponent(selectedMunicipio)}&tipo=2`)
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
    const enviarBtn = document.getElementById('enviar-btn'); // Referência ao botão de envio
    tabela.innerHTML = ''; // Limpa a tabela

    if (dados.length === 0) {
        tabela.innerHTML = '<tr><td colspan="4">Nenhum dado encontrado.</td></tr>';
        enviarBtn.setAttribute('disabled', true); // Desativa o botão se não houver dados
        return;
    }

    enviarBtn.removeAttribute('disabled'); // Habilita o botão se houver dados

    dados.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.aluno || '-'}</td>
            <td>${item.turma || '-'}</td>
            <td>${item.data || '-'}</td>
            <td>${item.ocorrencia || '-'}</td>
        `;
        tabela.appendChild(row);
    });
}

function popularDropdowns(dados) {
    const escolaSelect = document.getElementById('escola');
    const responsavelSelect = document.getElementById('responsavel');

    const escolas = [...new Set(dados.map(d => d.escola))];
    const responsaveis = [...new Set(dados.map(d => d.responsavel))];

    escolaSelect.innerHTML = '<option value="">Todas as Escolas</option>';
    responsavelSelect.innerHTML = '<option value="">Todos os Responsáveis</option>';

    escolas.forEach(escola => {
        const option = document.createElement('option');
        option.value = escola;
        option.textContent = escola;
        escolaSelect.appendChild(option);
    });

    responsaveis.forEach(responsavel => {
        const option = document.createElement('option');
        option.value = responsavel;
        option.textContent = responsavel;
        responsavelSelect.appendChild(option);
    });

    escolaSelect.onchange = filtrarTabela;
    responsavelSelect.onchange = filtrarTabela;
}

function filtrarTabela() {
    const escolaSelect = document.getElementById('escola').value;
    const responsavelSelect = document.getElementById('responsavel').value;

    const dadosFiltrados = dadosCompletos.filter(item => {
        return (
            (!escolaSelect || item.escola === escolaSelect) &&
            (!responsavelSelect || item.responsavel === responsavelSelect)
        );
    });

    atualizarTabela(dadosFiltrados);
}

function verificarStatusWhatsapp() {
    fetch('/api/check-whatsapp')
        .then(response => response.json())
        .then(data => {
            clientReady = data.connected;
            const statusElement = document.getElementById('whatsapp-status');
            statusElement.style.color = clientReady ? '#28a745' : '#ff0000';

            if (!clientReady && data.qr) {
                abrirModal(data.qr);
            }
        })
        .catch(error => console.error('Erro ao verificar status do WhatsApp:', error));
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

function enviarMensagem() {
    if (!clientReady) {
        alert('WhatsApp não está conectado. Por favor, conecte-se antes de enviar mensagens.');
        return;
    }

    const municipioSelect = document.getElementById('municipio');
    const selectedMunicipio = municipioSelect.value;

    if (!selectedMunicipio) {
        alert('Selecione um município antes de enviar as mensagens.');
        return;
    }

    const escolaSelect = document.getElementById('escola').value;
    const responsavelSelect = document.getElementById('responsavel').value;

    const dadosFiltrados = dadosCompletos.filter(item => {
        return (
            (!escolaSelect || item.escola === escolaSelect) &&
            (!responsavelSelect || item.responsavel === responsavelSelect)
        );
    });

    if (dadosFiltrados.length === 0) {
        alert('Nenhum dado encontrado para envio.');
        return;
    }

    fetch('/api/respinforma/send-messages', {
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
            alert('Mensagens enviadas com sucesso!');
        })
        .catch(error => {
            console.error('Erro ao enviar mensagens:', error);
            alert('Erro ao enviar mensagens. Verifique o console para mais detalhes.');
        });
}
