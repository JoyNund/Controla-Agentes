const fs = require('fs')
const path = require('path')

let pdfParse = null
let mammoth = null

try {
    pdfParse = require('pdf-parse')
} catch (_) {}
try {
    mammoth = require('mammoth')
} catch (_) {}

/**
 * Extrae texto de archivos de base de conocimiento para que el agente pueda usarlo.
 * Soporta: .txt, .md, .pdf, .doc, .docx
 */
async function extractTextFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    const buffer = fs.readFileSync(filePath)

    if (ext === '.txt' || ext === '.md') {
        return buffer.toString('utf8')
    }

    if (ext === '.pdf' && pdfParse) {
        const data = await pdfParse(buffer)
        return data.text || ''
    }

    if ((ext === '.doc' || ext === '.docx') && mammoth) {
        const result = await mammoth.extractRawText({ buffer })
        return result.value || ''
    }

    if (ext === '.pdf' && !pdfParse) {
        throw new Error('Para leer PDF instala: npm install pdf-parse')
    }
    if ((ext === '.doc' || ext === '.docx') && !mammoth) {
        throw new Error('Para leer DOC/DOCX instala: npm install mammoth')
    }

    throw new Error(`Formato no soportado: ${ext}`)
}

module.exports = { extractTextFromFile }
