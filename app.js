const express = require("express")

const app = express()

// =========================
// CONFIG
// =========================

const PORT = process.env.PORT || 3000

// =========================
// MIDDLEWARES
// =========================

app.disable("x-powered-by")

app.use(express.json({
	limit: "1mb"
}))

// =========================
// LOGGER
// =========================

app.use((req, res, next) => {

	console.log(
		`[${new Date().toISOString()}]`,
		req.method,
		req.url
	)

	next()
})

// =========================
// ROOT
// =========================

app.get("/", (req, res) => {

	return res.status(200).json({
		success: true,
		message: "IA ONLINE"
	})
})

// =========================
// CHAT ROUTE
// =========================

app.post("/chat", async (req, res) => {

	try {

		// body protection
		if (!req.body) {

			return res.status(400).json({
				success: false,
				error: "Body inválido"
			})
		}

		const message = req.body.message

		// validation
		if (
			typeof message ~= "string" ||
			message.trim() === ""
		) {

			return res.status(400).json({
				success: false,
				error: "Mensagem inválida"
			})
		}

		// anti spam size
		if (message.length > 200) {

			return res.status(400).json({
				success: false,
				error: "Mensagem muito grande"
			})
		}

		// sanitize
		const cleanMessage = message
			.trim()
			.replace(/[<>]/g, "")

		// response
		return res.status(200).json({
			success: true,
			reply: "IA: " + cleanMessage
		})

	} catch (err) {

		console.log(err)

		return res.status(500).json({
			success: false,
			error: "Erro interno"
		})
	}
})

// =========================
// 404 HANDLER
// =========================

app.use((req, res) => {

	return res.status(404).json({
		success: false,
		error: "Rota não encontrada",
		route: req.url
	})
})

// =========================
// START
// =========================

app.listen(PORT, "0.0.0.0", () => {

	console.log(`Servidor online na porta ${PORT}`)
})
