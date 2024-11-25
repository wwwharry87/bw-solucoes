const express = require('express');
const path = require('path');
const fs = require('fs');
const pdfMake = require('pdfmake');
const { MessageMedia } = require('whatsapp-web.js');
const moment = require('moment'); // Certifique-se de instalar o moment: npm install moment

const router = express.Router();

/**
 * Ajusta e valida números de telefone para o formato +55XXXXXXXXXXX.
 */
const ajustarTelefone = (telefone) => {
    if (!telefone) return null;

    const telefoneLimpo = telefone.replace(/\D/g, ''); // Remove caracteres não numéricos

    // Remove o '9' adicional após o DDD, se necessário
    if (telefoneLimpo.length === 11) {
        return `55${telefoneLimpo.replace(/^(\d{2})9/, '$1')}`; // Exemplo: 94991193336 -> 55949119336
    } else if (telefoneLimpo.length === 10) {
        return `55${telefoneLimpo}`;
    }

    return null;
};

/**
 * Gera um PDF com os dados usando PDFMake.
 */
const gerarPDF = async (dados, filePath) => {
    return new Promise((resolve, reject) => {
        const fonts = {
            Roboto: {
                normal: path.join(__dirname, '../fonts/Roboto-Regular.ttf'),
                bold: path.join(__dirname, '../fonts/Roboto-Bold.ttf'),
                italics: path.join(__dirname, '../fonts/Roboto-Italic.ttf'),
                bolditalics: path.join(__dirname, '../fonts/Roboto-BoldItalic.ttf'),
            },
        };

        const printer = new pdfMake(fonts);

        // Calcula o período da semana anterior
        const startOfWeek = moment().subtract(1, 'weeks').startOf('isoWeek').format('DD/MM/YYYY');
        const endOfWeek = moment().subtract(1, 'weeks').endOf('isoWeek').format('DD/MM/YYYY');

        const tableBody = [
            [
                { text: 'Turma', style: 'tableHeader' },
                { text: 'Professor', style: 'tableHeader' },
                { text: 'Disciplina', style: 'tableHeader' },
                { text: 'Data', style: 'tableHeader' },
                { text: 'Faltas', style: 'tableHeader' },
            ],
        ];

        // Adiciona os dados na tabela
        dados.forEach((item) => {
            tableBody.push([
                { text: item.turma || '-', style: 'tableData' },
                { text: item.professor || '-', style: 'tableData' },
                { text: item.disciplina || '-', style: 'tableData' },
                { text: item.data || '-', style: 'tableData' },
                { text: item.falta || '-', style: 'tableData' },
            ]);
        });

        const docDefinition = {
            content: [
                {
                    text: `Relatório de Pendências do Diário de Classe\n(Referente ao período de ${startOfWeek} a ${endOfWeek})`,
                    style: 'header'
                },
                { text: '\n' }, // Espaço entre o título e a tabela
                {
                    table: {
                        headerRows: 1,
                        widths: ['15%', '30%', '25%', '15%', '15%'],
                        body: tableBody,
                    },
                    layout: {
                        fillColor: (rowIndex) => (rowIndex % 2 === 0 ? '#f3f3f3' : null), // Zebra effect
                        hLineWidth: () => 0.5,
                        vLineWidth: () => 0.5,
                        hLineColor: () => '#ccc',
                        vLineColor: () => '#ccc',
                    },
                },
            ],
            styles: {
                header: {
                    fontSize: 16,
                    bold: true,
                    alignment: 'center',
                },
                tableHeader: {
                    bold: true,
                    fontSize: 12,
                    color: 'white',
                    fillColor: '#4CAF50', // Verde suave para o cabeçalho
                    alignment: 'center',
                },
                tableData: {
                    fontSize: 9,
                    alignment: 'left',
                },
            },
            defaultStyle: {
                font: 'Roboto',
            },
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);

        const stream = fs.createWriteStream(filePath);
        pdfDoc.pipe(stream);
        pdfDoc.end();

        stream.on('finish', resolve);
        stream.on('error', reject);
    });
};

/**
 * Rota para enviar mensagens com PDFs anexados para os coordenadores.
 */
router.post('/send-messages', async (req, res) => {
    const { municipio, dados } = req.body;

    if (!req.client || !req.client.info || !req.client.info.wid) {
        return res.status(400).json({
            success: false,
            message: 'WhatsApp não está conectado. Por favor, conecte antes de enviar mensagens.',
        });
    }

    if (!dados || dados.length === 0) {
        return res.status(400).json({ error: 'Nenhum dado para enviar mensagens.' });
    }

    try {
        const coordenadores = {};

        dados.forEach((item) => {
            const coordenador = item.coordenador || 'Desconhecido';
            if (!coordenadores[coordenador]) {
                coordenadores[coordenador] = [];
            }
            coordenadores[coordenador].push({
                turma: item.turma,
                professor: item.professor,
                disciplina: item.disciplina,
                data: item.data,
                falta: item.falta,
            });
        });

        for (const [coordenador, professores] of Object.entries(coordenadores)) {
            const telefone = ajustarTelefone(dados.find((item) => item.coordenador === coordenador)?.telefone);

            if (!telefone) {
                console.warn(`Telefone inválido ou não encontrado para o coordenador ${coordenador}`);
                continue;
            }

            const pdfPath = path.join(__dirname, `../temp/${coordenador.replace(/\s+/g, '_')}.pdf`);
            console.log(`Iniciando a geração do PDF em: ${pdfPath}`);
            await gerarPDF(professores, pdfPath);

            const message = `Olá *${coordenador}*,\n
sou o Assistente Virtual da *Smart4WEB*. Estou enviando em anexo o relatório com informações sobre o não preenchimento do diário de classe referente à semana anterior.\n
Por favor, verifique os dados e, caso precise de suporte, entre em contato com o técnico do Município!`;

            try {
                // Carrega o PDF como mídia
                const media = MessageMedia.fromFilePath(pdfPath);

                // Envia a mensagem com o PDF anexado
                await req.client.sendMessage(`${telefone}@c.us`, media, { caption: message });
                console.log(`Mensagem enviada para ${telefone}: ${message}`);
            } catch (error) {
                console.error(`Erro ao enviar mensagem para ${telefone}:`, error.message);
            } finally {
                fs.unlinkSync(pdfPath); // Remove o PDF após o envio
            }
        }

        res.json({ success: true, message: 'Mensagens enviadas com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar mensagens:', error.message);
        res.status(500).json({ error: 'Erro ao enviar mensagens.' });
    }
});

module.exports = router;
