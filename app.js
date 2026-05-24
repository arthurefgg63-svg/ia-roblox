const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// =========================
// CONFIG
// =========================

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_KEY;

// =========================
// VALIDAR KEY
// =========================

if (!GEMINI_KEY) {
    console.log("GEMINI_KEY não encontrada");
    process.exit(1);
}

// =========================
// GEMINI
// =========================

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// =========================
// MIDDLEWARE
// =========================

app.use(express.json({
    limit: "1mb"
}));

// =========================
// ROOT
// =========================

app.get("/", (req, res) => {

    return res.status(200).json({
        online: true,
        message: "API ONLINE"
    });

});

// =========================
// IA
// =========================

app.post("/ia", async (req, res) => {

    try {

        const body = req.body;

        if (!body) {

            return res.status(400).json({
                error: "Body inválido"
            });

        }

        const message = body.message;

        if (
            typeof message !== "string" ||
            message.trim() === ""
        ) {

            return res.status(400).json({
                error: "Mensagem inválida"
            });

        }

        const cleanMessage = message
            .trim()
            .slice(0, 500);

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash"
        });

        const result = await model.generateContent(cleanMessage);

        const response = result.response;

        const text = response.text();

        return res.status(200).json({
            reply: text
        });

    } catch (err) {

        console.log(err);

        return res.status(500).json({
            error: "Erro interno"
        });

    }

});

// =========================
// 404
// =========================

app.use((req, res) => {

    return res.status(404).json({
        error: "404"
    });

});

// =========================
// START
// =========================

app.listen(PORT, "0.0.0.0", () => {

    console.log(`Servidor online na porta ${PORT}`);

});
