const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const {
    GoogleGenerativeAI
} = require("@google/generative-ai");

const app = express();

// =====================================================
// CONFIG
// =====================================================

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_KEY;

// =====================================================
// VALIDAR KEY
// =====================================================

if (!GEMINI_KEY) {

    console.error("❌ GEMINI_KEY NÃO ENCONTRADA");

    process.exit(1);

}

// =====================================================
// GEMINI
// =====================================================

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// =====================================================
// SECURITY
// =====================================================

app.disable("x-powered-by");

app.use(helmet());

app.use(compression());

app.use(express.json({
    limit: "1mb"
}));

// =====================================================
// RATE LIMIT
// =====================================================

const limiter = rateLimit({

    windowMs: 15 * 60 * 1000,

    max: 100,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
        success: false,
        error: "Muitas requisições"
    }

});

app.use(limiter);

// =====================================================
// LOGGER
// =====================================================

app.use((req, res, next) => {

    console.log(
        `[${new Date().toISOString()}]`,
        req.method,
        req.url
    );

    next();

});

// =====================================================
// ROOT
// =====================================================

app.get("/", (req, res) => {

    return res.status(200).json({
        success: true,
        online: true,
        message: "IA ONLINE"
    });

});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {

    return res.status(200).json({
        success: true,
        status: "healthy"
    });

});

// =====================================================
// IA
// =====================================================

app.post("/ia", async (req, res) => {

    try {

        // =====================================================
        // BODY
        // =====================================================

        if (!req.body) {

            return res.status(400).json({
                success: false,
                error: "Body inválido"
            });

        }

        const message = req.body.message;

        // =====================================================
        // VALIDAR TEXTO
        // =====================================================

        if (
            typeof message !== "string" ||
            message.trim() === ""
        ) {

            return res.status(400).json({
                success: false,
                error: "Mensagem inválida"
            });

        }

        // =====================================================
        // LIMITAR TAMANHO
        // =====================================================

        if (message.length > 500) {

            return res.status(400).json({
                success: false,
                error: "Mensagem muito grande"
            });

        }

        // =====================================================
        // SANITIZE
        // =====================================================

        const cleanMessage = message
            .trim()
            .replace(/[<>]/g, "");

        // =====================================================
        // MODELO
        // =====================================================

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash"
        });

        // =====================================================
        // TIMEOUT
        // =====================================================

        const timeoutPromise = new Promise((_, reject) => {

            setTimeout(() => {
                reject(new Error("Timeout Gemini"));
            }, 20000);

        });

        // =====================================================
        // REQUEST GEMINI
        // =====================================================

        const result = await Promise.race([
            model.generateContent(cleanMessage),
            timeoutPromise
        ]);

        // =====================================================
        // RESPOSTA
        // =====================================================

        const response = result.response;

        const text = response.text();

        // =====================================================
        // VALIDAR RESPOSTA
        // =====================================================

        if (
            typeof text !== "string" ||
            text.trim() === ""
        ) {

            return res.status(500).json({
                success: false,
                error: "Resposta vazia da IA"
            });

        }

        // =====================================================
        // SUCCESS
        // =====================================================

        return res.status(200).json({
            success: true,
            reply: text
        });

    } catch (err) {

        console.error("❌ ERRO GEMINI:");
        console.error(err);

        return res.status(500).json({
            success: false,
            error: "Erro interno",
            details: String(err.message || err)
        });

    }

});

// =====================================================
// 404
// =====================================================

app.use((req, res) => {

    return res.status(404).json({
        success: false,
        error: "Rota não encontrada"
    });

});

// =====================================================
// START
// =====================================================

app.listen(PORT, "0.0.0.0", () => {

    console.log(`✅ Servidor online na porta ${PORT}`);

});
