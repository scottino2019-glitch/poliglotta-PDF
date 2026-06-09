import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  Upload,
  Globe2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  X,
  FileCheck,
  RefreshCw,
  Download,
  Copy,
  Plus,
  Sparkles,
  Info
} from "lucide-react";

// Types
interface PDFAttachment {
  name: string;
  size: number;
  url: string;
  isCustom?: boolean;
}

const INITIAL_PDFS: PDFAttachment[] = [
  {
    name: "Chinese_Beginners_Grammar.pdf",
    size: 110480,
    url: "/pdfs/Chinese_Beginners_Grammar.pdf"
  },
  {
    name: "Frasi_Utili_Giapponese.pdf",
    size: 94810,
    url: "/pdfs/Frasi_Utili_Giapponese.pdf"
  },
  {
    name: "French_Travel_Conversation.pdf",
    size: 165200,
    url: "/pdfs/French_Travel_Conversation.pdf"
  }
];

export default function App() {
  // State
  const [pdfs, setPdfs] = useState<PDFAttachment[]>(INITIAL_PDFS);
  const [activePdf, setActivePdf] = useState<PDFAttachment | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(false);
  const [uploadingPdf, setUploadingPdf] = useState<boolean>(false);
  
  // Notebook/study state
  const [studyNotes, setStudyNotes] = useState<string>("");
  const [noteWords, setNoteWords] = useState<number>(0);

  // Extracted PDF text for clicking/copying
  const [extractedLines, setExtractedLines] = useState<string[]>([]);
  const [extractingText, setExtractingText] = useState<boolean>(false);

  // Status updates
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper for toast
  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  useEffect(() => {
    // Carica il primo PDF memorizzato per iniziare subito
    if (INITIAL_PDFS.length > 0) {
      handleLoadPDF(INITIAL_PDFS[0]);
    }
    
    // Carica note salvate in localStorage
    const cachedNotes = localStorage.getItem("lingua_read_study_notes");
    if (cachedNotes) {
      setStudyNotes(cachedNotes);
      setNoteWords(cachedNotes.trim() === "" ? 0 : cachedNotes.trim().split(/\s+/).length);
    }
  }, []);

  // Aggiorna le note e salva nel localStorage
  const handleNotesChange = (text: string) => {
    setStudyNotes(text);
    const count = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    setNoteWords(count);
    localStorage.setItem("lingua_read_study_notes", text);
  };

  // Caricamento PDF locale interamente client-side via Blob URL
  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      showToast("Seleziona un file PDF valido!", true);
      return;
    }

    try {
      setUploadingPdf(true);
      showToast(`Aggiunta del file "${file.name}"...`);

      // Creazione di un object URL client-side istantaneo e sicuro dal file selezionato
      const objectUrl = URL.createObjectURL(file);
      
      const newPdf: PDFAttachment = {
        name: file.name,
        size: file.size,
        url: objectUrl,
        isCustom: true
      };

      setPdfs(prev => [newPdf, ...prev]);
      setActivePdf(newPdf);
      setCurrentPage(1);
      setExtractedLines([]);
      
      setTimeout(() => {
        handleLoadPDF(newPdf);
        showToast("PDF aggiunto con successo alla sessione locale!");
      }, 300);

    } catch (error: any) {
      console.error(error);
      showToast("Errore nel caricamento del file.", true);
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Eliminazione client-side di un PDF dalla sessione corrente
  const handleDeletePdf = (e: React.MouseEvent, pdfName: string) => {
    e.stopPropagation(); // prevent load
    if (!confirm(`Vuoi rimuovere il file "${pdfName}" dalla sessione corrente dell'applicazione?`)) {
      return;
    }

    setPdfs(prev => {
      const filtered = prev.filter(p => p.name !== pdfName);
      
      // Se il PDF attivo è quello appena rimosso, azzera la vista
      if (activePdf?.name === pdfName) {
        if (filtered.length > 0) {
          setTimeout(() => handleLoadPDF(filtered[0]), 100);
        } else {
          setActivePdf(null);
          setTotalPages(0);
          setExtractedLines([]);
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      }
      return filtered;
    });

    showToast("PDF rimosso dalla sessione corrente.");
  };

  // Render e caricamento PDF tramite pdfjsLib
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const handleLoadPDF = async (pdfItem: PDFAttachment) => {
    if (!window.hasOwnProperty("pdfjsLib")) {
      showToast("Il motore di rendering PDF sta caricando, riprova tra un secondo.", true);
      return;
    }

    try {
      setLoadingPdf(true);
      setActivePdf(pdfItem);
      setCurrentPage(1);
      setExtractedLines([]);
      
      const pdfjsLib = (window as any).pdfjsLib;
      const loadingTask = pdfjsLib.getDocument(pdfItem.url);
      
      const pdfDoc = await loadingTask.promise;
      pdfDocRef.current = pdfDoc;
      setTotalPages(pdfDoc.numPages);
      
      await renderPdfPage(pdfDoc, 1);
    } catch (error: any) {
      console.error("Error loading PDF document:", error);
      showToast("Impossibile leggere il PDF. Assicurati che il file non sia corrotto.", true);
    } finally {
      setLoadingPdf(false);
    }
  };

  const renderPdfPage = async (pdfDoc: any, pageNumber: number) => {
    if (!pdfDoc || !canvasRef.current) return;

    // Cancella l'operazione di rendering precedente se attiva
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch (err) {
        console.warn("Error cancelling previous render task:", err);
      }
      renderTaskRef.current = null;
    }

    try {
      setExtractingText(true);
      const page = await pdfDoc.getPage(pageNumber);
      
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      
      if (context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        
        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        
        await renderTask.promise;
        renderTaskRef.current = null;
      }

      // Estrazione del testo della pagina per facilitare la copia e l'inserimento
      const textContent = await page.getTextContent();
      const lines: string[] = [];
      let tempLine = "";
      
      for (const item of textContent.items) {
        const text = item.str.trim();
        if (text) {
          if (text.match(/[.!?；。！？]$/) || tempLine.length > 80) {
            lines.push(tempLine ? `${tempLine} ${text}` : text);
            tempLine = "";
          } else {
            tempLine = tempLine ? `${tempLine} ${text}` : text;
          }
        }
      }
      if (tempLine) {
        lines.push(tempLine);
      }

      if (lines.length === 0) {
        lines.push("Nessun testo estraibile rilevato (potrebbe trattarsi di un file o un'immagine digitalizzata senza OCR).");
      }

      setExtractedLines(lines);
    } catch (error: any) {
      // Ignora l'errore di annullamento del rendering
      if (error && error.name === "RenderingCancelledException") {
        console.log("Rendering cancelled cycle.");
      } else {
        console.error("Error rendering PDF page:", error);
      }
    } finally {
      setExtractingText(false);
    }
  };

  const traversePage = async (offset: number) => {
    let targetPage = currentPage + offset;
    if (targetPage < 1) targetPage = 1;
    if (targetPage > totalPages) targetPage = totalPages;
    
    if (targetPage !== currentPage && pdfDocRef.current) {
      setCurrentPage(targetPage);
      await renderPdfPage(pdfDocRef.current, targetPage);
    }
  };

  // Integrazione facilitata per gli appunti
  const appendlineToNotes = (line: string) => {
    const formatted = studyNotes ? `${studyNotes}\n- ${line}` : `- ${line}`;
    handleNotesChange(formatted);
    showToast("Riga copiata e inserita nel Blocco Note!");
  };

  const copyLineToClipboard = (line: string) => {
    navigator.clipboard.writeText(line);
    showToast("Frase copiata negli appunti!");
  };

  const copyAllNotes = () => {
    if (!studyNotes.trim()) {
      showToast("Il blocco note è vuoto!", true);
      return;
    }
    navigator.clipboard.writeText(studyNotes);
    showToast("Blocco appunti completo copiato!");
  };

  const clearAllNotes = () => {
    if (!studyNotes.trim()) return;
    if (confirm("Sei sicuro di voler svuotare interamente il blocco note?")) {
      handleNotesChange("");
      showToast("Blocco note svuotato.");
    }
  };

  const downloadNotesAsFile = () => {
    if (!studyNotes.trim()) {
      showToast("Il blocco note è vuoto!", true);
      return;
    }

    const blob = new Blob([studyNotes], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Note_Studio_Lingue_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Note scaricate come file di testo!");
  };

  return (
    <div className="min-h-screen text-slate-800 flex flex-col font-sans selection:bg-indigo-150 selection:text-indigo-950 bg-[#F1F5F9]">
      
      {/* Toast notifications */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border text-sm font-medium ${
              toastMsg.isError 
                ? "bg-red-50 border-red-100 text-red-800 shadow-red-100" 
                : "bg-slate-900 border-slate-800 text-white shadow-slate-950/20"
            }`}
          >
            {toastMsg.isError ? (
              <X className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            )}
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styled Top Header Area */}
      <header className="glass-header h-16 flex flex-wrap items-center justify-between px-6 sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md text-white font-bold text-xl">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight flex items-center gap-2">
              LinguaRead
              <span className="text-slate-400 font-normal">| Multi-Language Suite</span>
            </h1>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPdf}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 text-xs font-medium rounded-full shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
          >
            {uploadingPdf ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4.5 h-4.5" />
            )}
            <span>Richiama PDF Locale</span>
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleLocalFileUpload}
            accept=".pdf"
            className="hidden"
          />
        </div>
      </header>

      {/* Content workspace has side lists + double main columns */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 min-w-0">
        
        {/* Leftmost Sidebar - File List / Library (Width: 60 / 240px) */}
        <aside className="w-full lg:w-60 border-r border-slate-200 bg-white p-4.5 flex flex-col shrink-0 lg:overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cartella Locale</p>
          </div>

          {/* List of PDFs */}
          {pdfs.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-xl p-5 text-center bg-slate-50/50">
              <FileCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-600">Nessun file</p>
              <p className="text-[10px] text-slate-400 mt-1">Trascina o carica file in locale per iniziare.</p>
            </div>
          ) : (
            <div className="space-y-1 select-none flex-1">
              {pdfs.map((pdf, idx) => {
                const isActive = activePdf?.name === pdf.name;
                
                return (
                  <div
                    key={idx}
                    onClick={() => handleLoadPDF(pdf)}
                    className={`sidebar-item flex items-center justify-between p-2 rounded cursor-pointer transition-all duration-150 relative ${
                      isActive 
                        ? "active-file shadow-xs" 
                        : "text-slate-600 hover:text-slate-900 text-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden mr-4">
                      <span className={isActive ? "text-blue-600" : "text-slate-400 shrink-0"}>
                        <FileText className="w-4 h-4" />
                      </span>
                      <p className={`text-sm font-medium truncate ${isActive ? "text-blue-900" : "text-slate-700"}`}>
                        {pdf.name}
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleDeletePdf(e, pdf.name)}
                      title="Rimuovi"
                      className="opacity-40 hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 transition-all shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Study hint card */}
          <div className="mt-auto pt-4 border-t border-slate-100">
            <div className="bg-indigo-50 p-3.5 rounded-lg border border-indigo-100/50">
              <p className="text-xs text-indigo-700 font-bold mb-1">TIP DI STUDIO</p>
              <p className="text-xs text-indigo-900 leading-relaxed">
                Traduci e leggi direttamente dal PDF, clicca sui testi emersi in basso per ricopiarli e scriverli velocemente nel grande Blocco Note di studio.
              </p>
            </div>
          </div>
        </aside>

        {/* Side-by-side workspace for Desktop (flex-row), vertical stacked for mobile (flex-col) */}
        <main className="flex-1 flex flex-col md:flex-row gap-6 p-6 overflow-y-auto lg:overflow-hidden min-h-0 bg-[#F1F5F9] min-w-0">
          
          {/* LEFT SIDE: PDF Viewer Page Card */}
          <section className="flex-1 flex flex-col h-[650px] md:h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm min-w-0">
            {/* Toolbar Header of PDF */}
            <div className="bg-slate-50 border-b border-slate-200/50 px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 overflow-hidden mr-4">
                <FileText className="w-4 h-4 text-indigo-550 shrink-0" />
                <span className="text-sm font-semibold truncate text-slate-800">
                  {activePdf ? activePdf.name : "Lettore PDF"}
                </span>
              </div>

              {/* Page traversal */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => traversePage(-1)}
                  disabled={currentPage <= 1 || !activePdf}
                  className="p-1 text-slate-600 disabled:opacity-30 rounded-md hover:bg-slate-200 select-none cursor-pointer transition-all"
                  title="Pagina Precedente"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-xs text-slate-600 font-semibold select-none bg-white px-2.5 py-1 border border-slate-200 rounded-md shadow-xs">
                  {activePdf ? `${currentPage} di ${totalPages}` : "0 di 0"}
                </span>
                <button
                  onClick={() => traversePage(1)}
                  disabled={currentPage >= totalPages || !activePdf}
                  className="p-1 text-slate-600 disabled:opacity-30 rounded-md hover:bg-slate-200 select-none cursor-pointer transition-all"
                  title="Pagina Successiva"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document display view area */}
            <div className="flex-1 bg-slate-100 border-b border-slate-200/75 overflow-auto flex items-start justify-center p-6 relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-[size:16px_16px]">
              {loadingPdf && (
                <div className="absolute inset-0 bg-[#525659]/70 backdrop-blur-xs flex flex-col items-center justify-center z-10 text-white">
                  <RefreshCw className="w-7 h-7 animate-spin text-white mb-2" />
                  <p className="text-xs font-semibold">Lettura della pagina PDF...</p>
                </div>
              )}

              {!activePdf && (
                <div className="text-center py-20 px-6 my-auto text-slate-400 max-w-sm">
                  <Globe2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Seleziona un Documento</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Fai clic su un PDF nella Cartella Locale a sinistra per aprirlo, oppure usa il pulsante in alto per aggiungere i tuoi personali.
                  </p>
                </div>
              )}

              <canvas
                ref={canvasRef}
                className={`max-w-full shadow-2xl rounded bg-white border border-slate-800/10 transition-opacity duration-200 ${
                  activePdf ? "opacity-100" : "opacity-0 invisible h-0"
                }`}
              />
            </div>

            {/* Expansible Extracted text lines from current page */}
            {activePdf && (
              <div className="h-44 bg-slate-50 flex flex-col overflow-hidden shrink-0">
                <div className="bg-slate-150 border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-display">
                    <Info className="w-3.5 h-3.5 text-indigo-500" /> Testo Rilevato nella Pagina
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Scegli una riga da inserire nel Blocco Note
                  </span>
                </div>

                <div className="p-3 overflow-y-auto space-y-1.5 flex-1">
                  {extractingText ? (
                    <div className="flex items-center justify-center py-4 text-slate-400 space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                      <span className="text-xs">Rilevamento caratteri della pagina...</span>
                    </div>
                  ) : extractedLines.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-4">Nessun testo individuato in questa pagina.</p>
                  ) : (
                    extractedLines.map((line, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-slate-600 hover:text-slate-900 bg-white p-2 border border-slate-200/60 rounded-lg transition-all flex items-start justify-between gap-3 shadow-xs group"
                      >
                        <p className="leading-relaxed font-sans flex-1 pr-1 select-text">{line}</p>
                        
                        {/* Instant click assistance */}
                        <div className="flex items-center gap-1 shrink-0 opacity-80 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyLineToClipboard(line)}
                            title="Copia"
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => appendlineToNotes(line)}
                            title="Incolla nel blocco note"
                            className="p-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-600 cursor-pointer border border-indigo-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>

          {/* RIGHT SIDE: HUGE Lined Notebook Study Notes Sheet (Large on Mobile with min-h-[650px] otherwise flex-1 full on desktop) */}
          <section className="flex-1 flex flex-col min-h-[650px] md:min-h-0 md:h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm min-w-0">
            {/* Header / Titles of Notes Area */}
            <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-widest font-display">
                  Area Studio / Appunti
                </span>
                <span className="text-[10px] bg-indigo-50 text-indigo-650 font-semibold px-2.5 py-0.5 rounded-full font-mono">
                  {noteWords} parole
                </span>
              </div>

              {/* Options */}
              <div className="flex items-center gap-2">
                <button
                  onClick={copyAllNotes}
                  title="Copia Tutto"
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shadow-xs hover:text-slate-800 flex items-center gap-1 text-xs px-2 cursor-pointer font-medium"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copia</span>
                </button>
                <button
                  onClick={downloadNotesAsFile}
                  title="Scarica Note (.txt)"
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shadow-xs hover:text-slate-800 flex items-center gap-1 text-xs px-2 cursor-pointer font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salva</span>
                </button>
                <button
                  onClick={clearAllNotes}
                  title="Resetta Note"
                  className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 text-slate-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Notebook Lined Paper with margin line */}
            <div className="flex-1 flex flex-col min-h-0 relative bg-white overflow-hidden">
              {/* Lined Margin */}
              <div className="absolute inset-y-0 pointer-events-none border-l-2 border-red-200 left-8 z-10" />
              
              {/* Massive input text notes field */}
              <textarea
                value={studyNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Fai clic sul tasto (+) in corrispondenza del testo rilevato in basso a sinistra per inserirlo all'istante o digita liberamente regole, grammatica e coniugazioni."
                className="w-full h-full p-6 pl-12 text-[14px] leading-[28px] focus:outline-none notebook-paper text-slate-700 font-sans resize-none z-0"
              />
            </div>

            {/* Status footer for paper notes alignment */}
            <div className="bg-slate-50 border-t border-slate-100/50 px-4 py-2.5 flex items-center justify-between text-[10px] text-slate-400 shrink-0 select-none">
              <span className="font-semibold">Blocco Note Regolato (line-height 28px)</span>
              <span>Allineamento righe attivo</span>
            </div>
          </section>

        </main>

      </div>
    </div>
  );
}
