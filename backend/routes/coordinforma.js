const express = require('express');
const router = express.Router();
const { enviarParaCoordenador } = require('../controllers/coordinformaController');

router.post('/enviar-mensagem', async (req, res) => {
    const { coordenador, dados } = req.body;
    // Verifique o status do WhatsApp e envie os dados para o coordenador
    if (!coordenador || !dados) {
        return res.status(400).json({ error: 'Coordenador ou dados não fornecidos' });
    }

    enviarParaCoordenador(coordenador, dados);
    res.json({ success: true, message: 'Mensagem enviada com sucesso!' });
});

module.exports = router;
