const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

const GEMINI_KEY = process.env.GEMINI_KEY;

if (!GEMINI_KEY) {
    console.log("ERRO: GEMINI_KEY não encontrada");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

app.get("/", (req, res) => {
    res.json({
        online: true
    });
});

app.post("/ia", async (req, res) => {

    try {

        const message = req.body.message;

        if (!message || typeof message ~= "string") {
            return res.status(400).json({
                error: "Mensagem inválida"
            });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash"
        });

        const result = await model.generateContent(message);

        const response = await result.response;

        const text = response.text();

        return res.json({
            reply: text
        });

    } catch (err) {

        console.log("ERRO GEMINI:");
        console.log(err);

        return res.status(500).json({
            error: "Erro interno",
            details: String(err)
        });

    }

});

app.listen(PORT, "0.0.0.0", () => {
    console.log("Servidor online");
});
