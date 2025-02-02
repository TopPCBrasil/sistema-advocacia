const express = require("express");
const multer = require("multer");
const fs = require("fs");
const readline = require("readline");  // Adicionado para permitir entrada no terminal
const { google } = require("googleapis");

const app = express();
const PORT = 3000;

// Configuração do Multer para upload de arquivos
const upload = multer({ dest: "uploads/" });

// IDs do Google Drive e Sheets (Substituir pelos IDs reais)
const SHEET_ID = "1Zntsagb1tGZiHQW-WkN1ljqv3S6eRKVu5VzmrwH3wwM";  // ID da sua planilha do Google Sheets
const FOLDER_ID = "1CfrzlbEFh4utjRfmBH63xtv9XSHbQhDZ";  // ID da pasta onde os PDFs serão salvos no Google Drive

const CREDENTIALS_PATH = "./credentials.json";
const TOKEN_PATH = "./token.json";

// Função para autenticar na API do Google
async function authorize() {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (fs.existsSync(TOKEN_PATH)) {
        oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
        return oAuth2Client;
    }

    // Gerar URL de autenticação
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/spreadsheets"],
    });

    console.log("\n🔹 **Acesse este link para autorizar o aplicativo:**\n");
    console.log(authUrl);
    console.log("\n🔹 **Depois de permitir o acesso, copie o código gerado e cole aqui.**\n");

    // Criar interface para entrada manual do código
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question("🔹 **Cole o código de autenticação aqui:** ", (code) => {
            rl.close();
            oAuth2Client.getToken(code, (err, token) => {
                if (err) {
                    console.error("❌ Erro ao obter o token:", err);
                    return;
                }
                oAuth2Client.setCredentials(token);
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
                console.log("✅ Token salvo com sucesso!");
                resolve(oAuth2Client);
            });
        });
    });
}

// Rota principal
app.get("/", (req, res) => {
    res.send("Servidor rodando com sucesso! 🚀");
});

// Rota para receber o cadastro do cliente e o PDF
app.post("/cadastrar", upload.single("pdf"), async (req, res) => {
    try {
        const auth = await authorize();
        const drive = google.drive({ version: "v3", auth });
        const sheets = google.sheets({ version: "v4", auth });

        const nome = req.body.nome;
        const pdfFilePath = req.file.path;

        if (!nome || !req.file) {
            return res.status(400).json({ message: "Erro: Nome e PDF são obrigatórios!" });
        }

        console.log(`📥 Cadastro recebido: Nome = ${nome}, PDF = ${req.file.originalname}`);

        // Upload do arquivo para o Google Drive
        const fileMetadata = {
            name: req.file.originalname,
            parents: [FOLDER_ID],
        };
        const media = {
            mimeType: "application/pdf",
            body: fs.createReadStream(pdfFilePath),
        };
        let file = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: "id",
        });

        let fileId = file.data.id;
        let fileLink = `https://drive.google.com/uc?id=${fileId}`;

        console.log(`✅ Arquivo PDF salvo no Google Drive: ${fileLink}`);

        // Adicionar os dados ao Google Sheets
        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: "Clientes!A:C",
            valueInputOption: "RAW",
            resource: { values: [[new Date().getTime(), nome, fileLink]] },
        });

        console.log(`✅ Cadastro salvo na planilha: Nome = ${nome}, Link = ${fileLink}`);

        // Apagar o arquivo temporário do servidor
        fs.unlinkSync(pdfFilePath);

        res.json({ message: "Cliente cadastrado com sucesso!" });
    } catch (error) {
        console.error("❌ Erro ao cadastrar:", error);
        res.status(500).json({ message: "Erro ao cadastrar cliente." });
    }
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
