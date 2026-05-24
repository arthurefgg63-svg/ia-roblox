const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const compression = require("compression");

const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// ======================================================
// CONFIG
// ======================================================

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_KEY;

// ======================================================
// VALIDAR KEY
// ======================================================

if (!GEMINI_KEY) {

    console.error("GEMINI_KEY não encontrada");

    process.exit(1);

}

// ======================================================
// GEMINI
// ======================================================

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// ======================================================
// SECURITY
// ======================================================

app.disable("x-powered-by");

app.use(helmet());

app.use(compression());

app.use(express.json({
    limit: "1mb"
}));

// ======================================================
// RATE LIMIT
// ======================================================

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: "Muitas requisições"
    }
});

app.use(limiter);

// ======================================================
// LOGGER
// ======================================================

app.use((req, res, next) => {

    console.log(
        `[${new Date().toISOString()}]`,
        req.method,
        req.url
    );

    next();

});

// ======================================================
// ROOT
// ======================================================

app.get("/", (req, res) => {

    return res.status(200).json({
        online: true,
        status: "API ONLINE"
    });

});

// ======================================================
// IA
// ======================================================

app.post("/ia", async (req, res) => {

    try {

        // ======================================================
        // BODY
        // ======================================================

        if (!req.body) {

            return res.status(400).json({
                error: "Body inválido"
            });

        }

        const message = req.body.message;

        // ======================================================
        // VALIDAR MESSAGE
        // ======================================================

        if (
            typeof message !== "string" ||
            message.trim() === ""
        ) {

            return res.status(400).json({
                error: "Mensagem inválida"
            });

        }

        // ======================================================
        // LIMITAR TEXTO
        // ======================================================

        if (message.length > 500) {

            return res.status(400).json({
                error: "Mensagem muito grande"
            });

        }

        // ======================================================
        // SANITIZE
        // ======================================================

        const cleanMessage = message
            .trim()
            .replace(/[<>]/g, "");

        // ======================================================
        // MODEL
        // ======================================================

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash"
        });

        // ======================================================
        // GEMINI REQUEST
        // ======================================================

        const result = await model.generateContent(cleanMessage);

        const response = result.response;

        const text = response.text();

        // ======================================================
        // VALIDAR RESPOSTA
        // ======================================================

        if (!text) {

            return res.status(500).json({
                error: "Sem resposta da IA"
            });

        }

        // ======================================================
        // SUCCESS
        // ======================================================

        return res.status(200).json({
            success: true,
            reply: text
        });

    } catch (err) {

        console.error("ERRO GEMINI:");
        console.error(err);

        return res.status(500).json({
            success: false,
            error: "Erro interno",
            details: String(err)
        });

    }

});

// ======================================================
// 404
// ======================================================

app.use((req, res) => {

    return res.status(404).json({
        error: "404"
    });

});

// ======================================================
// START
// ======================================================

app.listen(PORT, "0.0.0.0", () => {

    console.log(`Servidor online na porta ${PORT}`);

});
