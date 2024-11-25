const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const axios = require('axios');

// Importação dos controllers
const coordInformaRoutes = require('./controllers/coordinformaController');
const respInformaRoutes = require('./controllers/respinformaController');


const app = express();

// Configuração para permitir o envio de JSON e URL encoded com tamanho maior
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuração de sessão
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 600000 }
}));

// Função para carregar os dados de usuários do arquivo
function carregarUsuarios() {
    const usuarios = [];
    const arquivoPath = path.join(__dirname, 'user_encrypted.txt');

    if (!fs.existsSync(arquivoPath)) {
        console.error('Arquivo de usuários não encontrado!');
        return usuarios;
    }

    try {
        const data = fs.readFileSync(arquivoPath, 'utf-8').trim();
        const linhas = data.split('\n');

        linhas.forEach((linha, index) => {
            if (index === 0 || !linha.trim()) return;
            const [nome, dataNascimento, usuario, senha, telefone] = linha.split(',');

            usuarios.push({
                nome: nome.trim(),
                dataNascimento: dataNascimento.trim(),
                usuario: usuario.trim().toLowerCase(),
                senha: senha.trim(),
                telefone: telefone.trim()
            });
        });
    } catch (error) {
        console.error('Erro ao carregar o arquivo de usuários:', error.message);
    }

    return usuarios;
}

// Rotas de login
app.post('/api/verificar-usuario', (req, res) => {
    const { username } = req.body;

    const usuarios = carregarUsuarios();
    const usuarioValido = usuarios.find(user => user.usuario === username.toLowerCase());

    if (usuarioValido) {
        res.json({ success: true, message: 'Usuário encontrado' });
    } else {
        res.json({ success: false, message: 'Usuário não encontrado' });
    }
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const usuarios = carregarUsuarios();
    const usuarioValido = usuarios.find(user => user.usuario === username.toLowerCase());

    if (usuarioValido) {
        const senhaValida = bcrypt.compareSync(password, usuarioValido.senha);
        if (senhaValida) {
            req.session.authenticated = true;
            req.session.user = usuarioValido.nome;
            res.json({ success: true, redirecionar: "/coordinforma.html" });
        } else {
            res.json({ success: false, message: 'Senha inválida' });
        }
    } else {
        res.json({ success: false, message: 'Usuário não encontrado' });
    }
});

app.get('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.sendStatus(200);
    });
});

// Rota principal
app.get('/', (req, res) => {
    if (req.session.authenticated) {
        res.redirect('/coordinforma.html');
    } else {
        res.sendFile(path.join(__dirname, '../frontend/public', 'login.html'));
    }
});

// Configuração do WhatsApp
let clientReady = false;
let qrCodeData = null;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 60000 // Tempo limite para inicialização do Puppeteer
    }
});

// Evitar múltiplas instâncias do cliente
let isInitializing = false;

client.on('qr', async (qr) => {
    if (!qrCodeData) {
        qrCodeData = await qrcode.toDataURL(qr);
        console.log('QR Code gerado. Escaneie para conectar.');
    }
});

client.on('ready', () => {
    console.log('WhatsApp conectado!');
    clientReady = true;
    qrCodeData = null;
});

client.on('disconnected', async (reason) => {
    console.log(`WhatsApp desconectado: ${reason}`);
    clientReady = false;

    // Verificar se já estamos tentando reiniciar o cliente
    if (!isInitializing) {
        isInitializing = true;
        setTimeout(async () => {
            try {
                console.log("Tentando reiniciar o cliente...");
                await client.initialize(); // Tente reiniciar a sessão
                isInitializing = false;
            } catch (error) {
                console.error("Erro ao tentar reiniciar o cliente:", error.message);
            }
        }, 5000); // Delay de 5 segundos antes de reiniciar
    }
});

// Inicializar o cliente uma vez
if (!clientReady) {
    client.initialize();
}

// Rota para carregar os municípios do arquivo municipio.txt
app.get('/api/municipios', (req, res) => {
    const filePath = path.join(__dirname, 'data', 'municipio.txt');

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo municipio.txt não encontrado.' });
    }

    try {
        const data = fs.readFileSync(filePath, 'utf-8').trim();
        const linhas = data.split('\n');

        const municipios = {};

        linhas.forEach(linha => {
            const [nome, tipo, url] = linha.split(';');

            if (!municipios[nome]) {
                municipios[nome] = [];
            }

            municipios[nome].push({
                tipo: parseInt(tipo, 10),
                url: url.trim()
            });
        });

        const municipiosFormatados = Object.keys(municipios).map(nome => ({
            nome,
            dados: municipios[nome]
        }));

        res.json(municipiosFormatados);
    } catch (error) {
        console.error('Erro ao processar arquivo municipio.txt:', error.message);
        res.status(500).json({ error: 'Erro ao processar arquivo municipio.txt.' });
    }
});

// Rota para carregar e processar o CSV da URL
app.get('/api/dados-csv', async (req, res) => {
    const { municipio, tipo } = req.query;
    const filePath = path.join(__dirname, 'data', 'municipio.txt');

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo municipio.txt não encontrado.' });
    }

    try {
        const data = fs.readFileSync(filePath, 'utf-8').trim();
        const linhas = data.split('\n');

        const linhaMunicipio = linhas.find(linha => {
            const [nome, tipoMunicipio] = linha.split(';');
            return nome.trim() === municipio && tipoMunicipio.trim() === tipo;
        });

        if (!linhaMunicipio) {
            return res.status(404).json({ error: `Nenhuma URL encontrada para o município ${municipio} com tipo ${tipo}.` });
        }

        const [, , url] = linhaMunicipio.split(';');
        const response = await axios.get(url.trim());
        const csvData = response.data;

        const dados = csvData
            .split('\n')
            .slice(1)
            .map(line => {
                const colunas = line.split(',');

                if (tipo === '1') {
                    return {
                        escola: colunas[0]?.trim(),
                        turma: colunas[2]?.trim(),
                        professor: colunas[3]?.trim(),
                        coordenador: colunas[4]?.trim(),
                        telefone: colunas[5]?.trim(),
                        disciplina: colunas[7]?.trim(),
                        data: colunas[8]?.trim(),
                        falta: colunas[9]?.trim(),
                    };
                } else if (tipo === '2') {
                    return {
                        escola: colunas[0]?.trim(),
                        turma: colunas[1]?.trim(),
                        responsavel: colunas[2]?.trim(),
                        aluno: colunas[3]?.trim(),
                        data: colunas[4]?.trim(),
                        telefone: colunas[5]?.trim(),
                    };
                }

                return {};
            });

        res.json(dados);
    } catch (error) {
        console.error('Erro ao processar dados do CSV:', error.message);
        res.status(500).json({ error: 'Erro ao processar dados do CSV.' });
    }
});

// Rota para verificar o status de conexão do WhatsApp
app.get('/api/check-whatsapp', (req, res) => {
    if (clientReady) {
        res.json({ connected: true });
    } else {
        res.json({ connected: false, qr: qrCodeData });
    }
});

// Rotas para CoordInforma e RespInforma
app.use('/api/coordinforma', (req, res, next) => {
    req.client = client;
    next();
}, coordInformaRoutes);

app.use('/api/respinforma', (req, res, next) => {
    req.client = client;
    next();
}, respInformaRoutes);

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Configuração do servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
