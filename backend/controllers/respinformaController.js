const express = require('express');
const router = express.Router();

/**
 * Pausa a execução por um determinado tempo.
 * @param {number} ms Tempo em milissegundos.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

router.post('/send-messages', async (req, res) => {
    const { municipio, dados } = req.body;
    const client = req.client;

    if (!client || !client.info || !client.info.pushname) {
        console.error('Cliente do WhatsApp não está conectado ou está indisponível.');
        return res.status(500).json({ error: 'WhatsApp não está conectado ou indisponível.' });
    }

    if (!dados || dados.length === 0) {
        return res.status(400).json({ error: 'Nenhum dado para envio.' });
    }

    console.log(`WhatsApp conectado como: ${client.info.pushname}`);

    const resultados = [];
    try {
        // Agrupar por responsável
        const responsaveis = {};
        dados.forEach((item) => {
            let numero = item.telefone.replace(/\D/g, ''); // Remove caracteres não numéricos

            // Remove o '9' adicional após o DDD, caso exista
            if (numero.length === 11) {
                numero = numero.replace(/^(\d{2})9/, '$1'); // Exemplo: 94991193336 -> 9491193336
            }

            // Formata o número com o código do Brasil
            const telefone = numero ? `55${numero}@c.us` : null;

            if (!telefone) {
                console.error(`Telefone não encontrado ou inválido para o responsável: ${item.responsavel}`);
                return;
            }

            if (!responsaveis[telefone]) {
                responsaveis[telefone] = [];
            }
            responsaveis[telefone].push(item);
        });

        // Enviar mensagens por responsável em lotes
        const telefones = Object.keys(responsaveis);
        for (let i = 0; i < telefones.length; i += 10) {
            const lote = telefones.slice(i, i + 10);

            for (const telefone of lote) {
                const alunoDados = responsaveis[telefone];
                let mensagem;

                const responsavel = alunoDados[0].responsavel; // Assume que todos têm o mesmo responsável
                const dataFalta = alunoDados[0].data; // Assume que a data é a mesma para todos

                mensagem = `📢 *Atenção, ${responsavel}!* 📢\n` +
                    `Aqui é o *Assistente Virtual da Smart4WEB*, trazendo informações importantes sobre os alunos sob sua responsabilidade. 🏫\n\n` +
                    `❌ *Os seguintes alunos tiveram ausência registrada no dia ${dataFalta}:*\n\n`;

                alunoDados.forEach((aluno) => {
                    mensagem += `🎓 *Nome:* ${aluno.aluno}\n` +
                        `📍 *Escola:* ${aluno.escola}\n` +
                        `📚 *Turma:* ${aluno.turma}\n`;

                    if (aluno.ocorrencia === "SIM") {
                        mensagem += `⚠️ *Ocorrência:* Foi registrada uma ocorrência para esta data. Entre em contato com a escola para mais informações.\n`;
                    }

                    mensagem += `\n`;
                });

                mensagem += `⚠️ Por favor, entre em contato com as respectivas escolas para mais informações.`;

                try {
                    console.log(`Enviando mensagem para: ${telefone}`);
                    await client.sendMessage(telefone, mensagem); // Envia mensagem no WhatsApp
                    resultados.push({ telefone, status: 'enviado' });
                } catch (sendError) {
                    console.error(`Erro ao enviar mensagem para ${telefone}:`, sendError.message);
                    resultados.push({ telefone, status: 'falha', motivo: sendError.message });
                }
            }

            // Pausa de 4 segundos entre os lotes
            if (i + 10 < telefones.length) {
                console.log('Pausa de 4 segundos antes de enviar o próximo lote...');
                await delay(4000);
            }
        }

        res.json({
            success: true,
            message: 'Processo de envio concluído.',
            resultados,
        });
    } catch (error) {
        console.error('Erro geral ao enviar mensagens:', error.message);
        res.status(500).json({ error: 'Erro ao enviar mensagens para os responsáveis.' });
    }
});

module.exports = router;
