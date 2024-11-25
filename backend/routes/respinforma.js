const express = require('express');
const router = express.Router();
const { enviarParaResponsavel } = require('../controllers/respinformaController');

router.post('/enviar-mensagem', async (req, res) => {
    const { responsavel, dados } = req.body;

    // Verifique se os dados necessários foram fornecidos
    if (!responsavel || !dados) {
        return res.status(400).json({ error: 'Responsável ou dados não fornecidos' });
    }

    enviarParaResponsavel(responsavel, dados);
    res.json({ success: true, message: 'Mensagem enviada com sucesso!' });
});

module.exports = router;
