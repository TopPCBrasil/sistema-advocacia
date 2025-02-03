const express = require("express");
const multer = require("multer");
const fs = require("fs");
const readline = require("readline");  
const { google } = require("googleapis");

const app = express();
const PORT = 3000;

// Permite que o frontend acesse o backend (CORS)
const cors = require("cors");
app.use(cors());

// Configuração do Multer para upload de arquivos
const upload = multer({ dest: "uploads/" });

// IDs do Google Drive e Sheets (Substituir pelos IDs reais)
const SHEET_ID = "1Zntsagb1tGZiHQW-WkN1ljqv3S6eRKVu5VzmrwH3wwM";  
const FOLDER_ID = "1CfrzlbEFh4utjRfmBH63xtv9XSHbQhDZ";  

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

        // 🔹 Aguarde um pouco para evitar problemas de permissão
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 🔹 Torna o arquivo público automaticamente
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: "reader",
                type: "anyone",
            },
        });

        // 🔹 Gerar o link de visualização correto do Google Drive
        let fileLink = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;


        console.log(`✅ Arquivo PDF salvo no Google Drive e agora é público: ${fileLink}`);

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

// 🔹 NOVA ROTA: Listar clientes do Google Sheets
app.get("/clientes", async (req, res) => {
    try {
        const auth = await authorize();
        const sheets = google.sheets({ version: "v4", auth });

        const resposta = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: "Clientes!A:C",
        });

        const linhas = resposta.data.values;
        if (!linhas || linhas.length === 0) {
            return res.json([]);
        }

        // Converter os dados em um formato mais organizado
        const clientes = linhas.slice(1).map((linha) => ({
            id: linha[0],
            nome: linha[1],
            link: linha[2],
        }));

        res.json(clientes);
    } catch (error) {
        console.error("❌ Erro ao buscar clientes:", error);
        res.status(500).json({ message: "Erro ao buscar clientes." });
    }
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
