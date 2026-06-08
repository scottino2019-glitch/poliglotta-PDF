import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Ensure directories exist
const publicDir = path.join(__dirname, "public");
const pdfDir = path.join(publicDir, "pdfs");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

// Write some sample PDF files if they don't exist
const samplePdfs = [
  {
    name: "Frasi_Utili_Giapponese.pdf",
    // Base64 minimal readable PDF that is light and renders perfectly
    base64: "JVBERi0xLjQKMSAwIG9iagogIDw8L1R5cGUgL0NhdGFsb2cKICAgIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKMiAwIG9iagogIDw8L1R5cGUgL1BhZ2VzCiAgICAvS2lkcyBbMyAwIFJdCiAgICAvQ291bnQgMQo+PgplbmRvYmoKMyAwIG9iagogIDw8L1R5cGUgL1BhZ2UKICAgIC9QYXJlbnQgMiAwIFIKICAgIC9NZWRpYUJveCBbMCAwIDU5NSA4NDJdCiAgICAvQ29udGVudHMgNCAwIFIKICAgIC9SZXNvdXJjZXMgPDwvRm9udCA8PC9GMSA1IDAgUj4+Pj4KPj4KZW5kb2JqCjQgMCBvYmoKICA8PC9MZW5ndGggMTcyPj4Kc3RyZWFtCkJVCiAgL0YxIDIyIFRmCiAgNzAgNzgwIFRkCiAgKEZyYXNpIFV0aWxpIGluIEdpYXBwb25lc2U6IEdaT05BIFNUVURJTykgVGoKICAwIC00MCBUZApzY3JpdmkgaWwgdGVzdG8gcXVpIHBlciB0cmFkdXJsbyBlZCBhbmFsaXp6YXJsbyEgVGoKICAwIC00MCBUZApzdXNoaSAo6I9b5Y+4KSAtIFBlc2NlIGNydWRvIGNvbiByaXNvIFRqCiAgMCAtMzAgVGQKby1nZW5raSBkZXN1IGthICjKJIYlbshbyKgpVGoKICAwIC0zMCBUZApnb2NoaXNvdXNhbWEgZGVzaGl0YSAo7qyG7qum7reO7rYpUagpFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKICA8PC9UeXBlIC9Gb250CiAgICAvU3VidHlwZSAvVHlwZTEKICAgIC9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTMyIDAwMDAwIG4gCjAwMDAwMDAzODYgMDAwMDAgbiAKMDAwMDAwMDUwOSAwMDAwMCBuIAp0cmFpbGVyCiAgPDwvU2l6ZSA2CiAgICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNTk5CiUlRU9GCg==",
  },
  {
    name: "Chinese_Beginners_Grammar.pdf",
    base64: "JVBERi0xLjQKMSAwIG9iagogIDw8L1R5cGUgL0NhdGFsb2cKICAgIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKMiAwIG9iagogIDw8L1R5cGUgL1BhZ2VzCiAgICAvS2lkcyBbMyAwIFJdCiAgICAvQ291bnQgMQo+PgplbmRvYmoKMyAwIG9iagogIDw8L1R5cGUgL1BhZ2UKICAgIC9QYXJlbnQgMiAwIFIKICAgIC9NZWRpYUJveCBbMCAwIDU5NSA4NDJdCiAgICAvQ29udGVudHMgNCAwIFIKICAgIC9SZXNvdXJjZXMgPDwvRm9udCA8PC9GMSA1IDAgUj4+Pj4KPj4KZW5kb2JqCjQgMCBvYmoKICA8PC9MZW5ndGggMTgyPj4Kc3RyZWFtCkJVCiAgL0YxIDIyIFRmCiAgNzAgNzgwIFRkCiAgKENoaW5lc2UgQmVnaW5uZXIncyBHcmFtbWFyKSBUagogIDAgLTQwIFRkCnNjcml2aSBpbCB0ZXN0byBxdWkgcGVyIHRyYWR1cmxvIGVkIGFuYWxpenphcmxvISBNdWx0aWxpbmd1ZSBUagogIDAgLTQwIFRkCk5pIGhhbyBtYSAo5L2g5aW95ZCXPykgLSBDb21lIHN0YWk/IFRqCiAgMCAtMzAgVGQKSmllamlhbiAo5Y676KGXKSAtIEFuZGFyZSBhbGxhIHN0cmFkYSBUagogIDAgLTMwIFRkClNoZW5tZSAo5LuA5LmIKSAtIENvc2E/IFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iagogIDw8L1R5cGUgL0ZvbnQKICAgIC9TdWJ0eXBlIC9UeXBlMQogICAgL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDcwIDAwMDAwIG4gCjAwMDAwMDAxMzIgMDAwMDAgbiAKMDAwMDAwMDM4NiAwMDAwMCBuIAowMDAwMDAwNTA5IDAwMDAwIG4gCnRyYWlsZXIKICA8PC9TaXplIDYKICAgIC9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo1OTkKJSVFT0YK",
  },
  {
    name: "French_Travel_Conversation.pdf",
    base64: "JVBERi0xLjQKMSAwIG9iagogIDw8L1R5cGUgL0NhdGFsb2cKICAgIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKMiAwIG9iagogIDw8L1R5cGUgL1BhZ2VzCiAgICAvS2lkcyBbMyAwIFJdCiAgICAvQ291bnQgMQo+PgplbmRvYmoKMyAwIG9iagogIDw8L1R5cGUgL1BhZ2UKICAgIC9QYXJlbnQgMiAwIFIKICAgIC9NZWRpYUJveCBbMCAwIDU5NSA4NDJdCiAgICAvQ29udGVudHMgNCAwIFIKICAgIC9SZXNvdXJjZXMgPDwvRm9udCA8PC9GMSA1IDAgUj4+Pj4KPj4KZW5kb2JqCjQgMCBvYmoKICA8PC9MZW5ndGggMTcyPj4Kc3RyZWFtCkJVCiAgL0YxIDIyIFRmCiAgNzAgNzgwIFRkCiAgKEZyZW5jaCBUcmF2ZWwgQ29udmVyc2F0aW9uKSBUagogIDAgLTQwIFRkCnNjcml2aSBpbCB0ZXN0byBxdWkgcGVyIHRyYWR1cmxvIGVkIGFuYWxpenphcmxvISBNdWx0aWxpbmd1ZSBUagogIDAgLTQwIFRkCkJvbmpvdXIsIGNvbW1lbnQgdmFzLXR1ID8gLSBCdW9uZ2lvcm5vLCBjb21lIHN0YWk/IFRqCiAgMCAtMzAgVGQKbSdpbnRlcmVzc2VyIHN1ciBsZSB2b3lhZ2UgLSBJbnRlcmVzc2Fyc2kgYWwgdmlhZ2dpbyBUagogIDAgLTMwIFRkCm1lcmNpIGJlYXVjb3VwIC0gR3JhemllIG1pbGxlIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iagogIDw8L1R5cGUgL0ZvbnQKICAgIC9TdWJ0eXBlIC9UeXBlMQogICAgL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDcwIDAwMDAwIG4gCjAwMDAwMDAxMzIgMDAwMDAgbiAKMDAwMDAwMDM4NiAwMDAwMCBuIAowMDAwMDAwNTA5IDAwMDAwIG4gCnRyYWlsZXIKICA8PC9TaXplIDYKICAgIC9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo1OTkKJSVFT0YK",
  },
];

for (const sample of samplePdfs) {
  const filePath = path.join(pdfDir, sample.name);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, Buffer.from(sample.base64, "base64"));
    console.log(`Saved sample PDF: ${sample.name}`);
  }
}

// Serve pdfs statically so client can fetch them
app.use("/pdfs", express.static(pdfDir));

// JSON Request body parser
app.use(express.json({ limit: "50mb" }));

// APIs for PDFs management
app.get("/api/pdfs", (req, res) => {
  try {
    const files = fs.readdirSync(pdfDir);
    const pdfFiles = files
      .filter((file) => file.toLowerCase().endsWith(".pdf"))
      .map((file) => ({
        name: file,
        size: fs.statSync(path.join(pdfDir, file)).size,
        url: `/pdfs/${file}`,
      }));
    res.json(pdfFiles);
  } catch (error) {
    console.error("Error reading PDF directory:", error);
    res.status(500).json({ error: "Errore nel caricamento della lista dei file PDF." });
  }
});

app.post("/api/pdfs/upload", (req, res) => {
  try {
    const { name, base64 } = req.body;
    if (!name || !base64) {
      return res.status(400).json({ error: "Nome file o dati base64 mancanti." });
    }

    // Clean filename
    let cleanName = name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    if (!cleanName.toLowerCase().endsWith(".pdf")) {
      cleanName += ".pdf";
    }

    const filePath = path.join(pdfDir, cleanName);
    const buffer = Buffer.from(base64, "base64");
    fs.writeFileSync(filePath, buffer);

    console.log(`Uploaded new PDF via api: ${cleanName}`);
    res.json({
      success: true,
      name: cleanName,
      url: `/pdfs/${cleanName}`,
      size: buffer.length,
    });
  } catch (error) {
    console.error("Error saving uploaded PDF:", error);
    res.status(500).json({ error: "Impossibile salvare il file PDF sul server." });
  }
});

// Delete PDF from local folder
app.delete("/api/pdfs/:name", (req, res) => {
  try {
    const fileName = req.params.name;
    const filePath = path.join(pdfDir, fileName);

    if (fs.existsSync(filePath)) {
      // Don't let users delete standard files if they want them to stay, but here they requested simple folder storage so we can allow it
      fs.unlinkSync(filePath);
      res.json({ success: true, message: `File ${fileName} eliminato con successo.` });
    } else {
      res.status(404).json({ error: "File non trovato." });
    }
  } catch (error) {
    console.error("Error deleting PDF:", error);
    res.status(500).json({ error: "Impossibile eliminare il file PDF." });
  }
});

// Vite server integrations
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server Poliglotta PDF running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
