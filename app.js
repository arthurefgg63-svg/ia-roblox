const express = require("express");

const app = express();

// Railway usa essa porta automaticamente
const PORT = process.env.PORT || 3000;

// Segurança básica
app.disable("x-powered-by");

// Middleware JSON blindado
app.use(express.json({ limit: "1mb" }));

// Página inicial
app.get("/", (req, res) => {
    res.status(200).send("API ONLINE");
});

// Endpoint da IA
app.post("/ia", (req, res) => {
    try {
        const message = req.body?.message;

        // Blindagem total
        if (
            typeof message !== "string" ||
            message.trim() === ""
        ) {
            return res.status(400).json({
                error: "Mensagem inválida"
            });
        }

        // Resposta simples
        const resposta = `Você disse: ${message}`;

        return res.status(200).json({
            reply: resposta
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: "Erro interno do servidor"
        });
    }
});

// Qualquer rota inexistente
app.use((req, res) => {
    res.status(404).json({
        error: "Rota não encontrada"
    });
});

// Inicialização blindada
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
