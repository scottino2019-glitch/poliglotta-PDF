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
  Info,
  FolderPlus,
  ArrowRight,
  Monitor,
  Smartphone
} from "lucide-react";

// Types
interface PDFAttachment {
  name: string;
  size: number;
  url: string;
  isCustom?: boolean;
  isFromPublicPdfs?: boolean;
}

// Simple Native IndexedDB support for storing large offline client-side PDF blobs
const DB_NAME = "LinguaReadDB_V2";
const STORE_NAME = "pdfs";

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "name" });
      }
    };
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
}

function savePDFToDB(name: string, data: Blob): Promise<void> {
  return initDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ name, data, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

function getPDFFromDB(name: string): Promise<Blob | null> {
  return initDB().then((db) => {
    return new Promise<Blob | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(name);
      request.onsuccess = (event: any) => {
        resolve(event.target.result ? event.target.result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }).catch(() => null);
}

function deletePDFFromDB(name: string): Promise<void> {
  return initDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }).catch(() => {});
}

// Vite glob scanning to dynamically list all PDF files placed directly inside /public/pdfs/
const pdfGlob = (import.meta as any).glob("/public/pdfs/*.pdf", { eager: true });

const GLOB_PDFS: PDFAttachment[] = Object.keys(pdfGlob).map((filePath) => {
  const name = filePath.split("/").pop() || filePath;
  return {
    name,
    size: 0,
    url: `/pdfs/${name}`,
    isFromPublicPdfs: true
  };
});

const DEFAULT_SAMPLES: PDFAttachment[] = [
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
  const [pdfs, setPdfs] = useState<PDFAttachment[]>([]);
  const [activePdf, setActivePdf] = useState<PDFAttachment | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(false);
  const [uploadingPdf, setUploadingPdf] = useState<boolean>(false);
  
  // Connect from public folder helper
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [connectFileName, setConnectFileName] = useState<string>("");

  // Mobile active layout tab switcher: "pdf" or "notes"
  const [activeTabMobile, setActiveTabMobile] = useState<"pdf" | "notes">("pdf");

  // Notebook/study state
  const [studyNotes, setStudyNotes] = useState<string>("");
  const [noteWords, setNoteWords] = useState<number>(0);
  const [noteFontSize, setNoteFontSize] = useState<number>(14);

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

  // Initialization: Load PDF list and merge with folder glob
  useEffect(() => {
    const loadInitialState = async () => {
      // 1. Get files physically present in the public/pdfs/ folder at compile/build time
      const publicPdfsFromGlob = GLOB_PDFS.length > 0 ? GLOB_PDFS : DEFAULT_SAMPLES;

      // 2. Get saved metadata from localStorage (mainly for user custom file-picker library)
      const savedList = localStorage.getItem("lingua_read_pdf_meta_list");
      let savedPdfs: PDFAttachment[] = [];
      if (savedList) {
        try {
          savedPdfs = JSON.parse(savedList);
        } catch (e) {
          savedPdfs = [];
        }
      }

      // 3. Keep only the user-custom physically imported files from the saved list
      const customLocalPdfs = savedPdfs.filter(p => p.isCustom);

      // 4. Merge the custom local uploads with the automatic folder files
      // This guarantees that any changes in public/pdfs/* at build time are reflected IMMEDIATELY without typing!
      const mergedList = [...customLocalPdfs, ...publicPdfsFromGlob];

      // Remove any item with duplicate names
      const uniqueMap = new Map<string, PDFAttachment>();
      mergedList.forEach(p => {
        uniqueMap.set(p.name, p);
      });
      const deduplicatedList = Array.from(uniqueMap.values());

      // Re-create Blob URLs for any custom offline database-backed PDFs
      const hydratedPdfs = await Promise.all(
        deduplicatedList.map(async (p) => {
          if (p.isCustom && (!p.url || !p.url.startsWith("blob:"))) {
            try {
              const fileBlob = await getPDFFromDB(p.name);
              if (fileBlob) {
                return {
                  ...p,
                  url: URL.createObjectURL(fileBlob)
                };
              }
            } catch (err) {
              console.warn("Could not retrieve file blob from IndexedDB for", p.name);
            }
          }
          return p;
        })
      );

      setPdfs(hydratedPdfs);
      persistPdfMetaList(hydratedPdfs); // update local storage cache safely

      if (hydratedPdfs.length > 0) {
        handleLoadPDF(hydratedPdfs[0]);
      }

      // Load study notes
      const cachedNotes = localStorage.getItem("lingua_read_study_notes");
      if (cachedNotes) {
        setStudyNotes(cachedNotes);
        setNoteWords(cachedNotes.trim() === "" ? 0 : cachedNotes.trim().split(/\s+/).length);
      }
    };

    loadInitialState();
  }, []);

  // Update notes and save to localStorage
  const handleNotesChange = (text: string) => {
    setStudyNotes(text);
    const count = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    setNoteWords(count);
    localStorage.setItem("lingua_read_study_notes", text);
  };

  // Save the updated list metadata to localStorage
  const persistPdfMetaList = (list: PDFAttachment[]) => {
    // We clean ObjectURLs out from meta storage so they are hydrated dynamically next time
    const safeList = list.map(item => ({
      name: item.name,
      size: item.size,
      url: item.isCustom ? "" : item.url, // custom blobs are loaded from indexedDB on boot
      isCustom: item.isCustom,
      isFromPublicPdfs: item.isFromPublicPdfs
    }));
    localStorage.setItem("lingua_read_pdf_meta_list", JSON.stringify(safeList));
  };

  // Client-side local PDF loaded & permanently stored in browser via IndexedDB
  const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      showToast("Seleziona un file PDF valido!", true);
      return;
    }

    try {
      setUploadingPdf(true);
      showToast(`Salvataggio permanente di "${file.name}" nel browser...`);

      // Store physically in IndexedDB
      await savePDFToDB(file.name, file);

      // Create local URL for current run
      const objectUrl = URL.createObjectURL(file);
      
      const newPdf: PDFAttachment = {
        name: file.name,
        size: file.size,
        url: objectUrl,
        isCustom: true
      };

      setPdfs(prev => {
        const updated = [newPdf, ...prev.filter(p => p.name !== file.name)];
        persistPdfMetaList(updated);
        return updated;
      });

      setActivePdf(newPdf);
      setCurrentPage(1);
      setExtractedLines([]);
      
      setTimeout(() => {
        handleLoadPDF(newPdf);
        showToast("PDF salvato ed inserito nella tua libreria locale!");
      }, 300);

    } catch (error: any) {
      console.error(error);
      showToast("Errore nel salvataggio offline del file.", true);
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Connect manual PDF from public/pdfs/
  const handleConnectPublicPdf = () => {
    if (!connectFileName.trim()) {
      showToast("Digita un nome file valido!", true);
      return;
    }

    let sanitized = connectFileName.trim();
    if (!sanitized.toLowerCase().endsWith(".pdf")) {
      sanitized += ".pdf";
    }

    const newPdf: PDFAttachment = {
      name: sanitized,
      size: 0,
      url: `/pdfs/${sanitized}`,
      isFromPublicPdfs: true
    };

    setPdfs(prev => {
      const updated = [newPdf, ...prev.filter(p => p.name !== sanitized)];
      persistPdfMetaList(updated);
      return updated;
    });

    setActivePdf(newPdf);
    setCurrentPage(1);
    setExtractedLines([]);
    setShowConnectModal(false);
    setConnectFileName("");

    setTimeout(() => {
      handleLoadPDF(newPdf);
      showToast(`File "${sanitized}" collegato dalla cartella public!`);
    }, 300);
  };

  // Delete/Clear PDF item from the application and browser
  const handleDeletePdf = async (e: React.MouseEvent, pdfName: string) => {
    e.stopPropagation(); // prevent loading
    if (!confirm(`Vuoi rimuovere permanentemente il file "${pdfName}" dal browser?`)) {
      return;
    }

    // Delete physically from IndexedDB if it was custom
    await deletePDFFromDB(pdfName);

    setPdfs(prev => {
      const filtered = prev.filter(p => p.name !== pdfName);
      persistPdfMetaList(filtered);
      
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

    showToast("File rimosso.");
  };

  // Reset library entirely to empty or sample files
  const handleClearAllLibrary = () => {
    if (confirm("Vuoi cancellare TUTTI i file dall'elenco per avere una libreria pulita con solo i tuoi testi?")) {
      setPdfs([]);
      localStorage.setItem("lingua_read_pdf_meta_list", JSON.stringify([]));
      setActivePdf(null);
      setTotalPages(0);
      setExtractedLines([]);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      showToast("Libreria svuotata completamente.");
    }
  };

  // Render and load PDF via pdfjsLib
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
      showToast("Impossibile leggere il PDF. Assicurati che il file sia presente in public/pdfs o riprova.", true);
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
    <div className="min-h-screen text-slate-800 flex flex-col font-sans selection:bg-indigo-150 selection:text-indigo-950 bg-[#F1F5F9] md:h-screen overflow-hidden">
      
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

      {/* Connect public PDF Modal */}
      <AnimatePresence>
        {showConnectModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 overflow-hidden relative"
            >
              <button 
                onClick={() => setShowConnectModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Collega PDF da public/pdfs/</h3>
                  <p className="text-xs text-slate-400">Inserisci il nome esatto del tuo file</p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 border border-slate-100 p-3 rounded-lg mb-4">
                Inserisci i tuoi file PDF personali nella barra laterale sinistra del codice di AI Studio nel percorso <strong className="font-mono text-purple-700">public/pdfs/</strong>, dopodiché scrivi il nome del file qui in basso per collegarlo ed aprirlo all'istante!
              </p>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Nome File:</label>
                <input
                  type="text"
                  placeholder="grammatica_cinese.pdf"
                  value={connectFileName}
                  onChange={(e) => setConnectFileName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConnectPublicPdf();
                  }}
                />

                {/* Discovered files list inside public/pdfs folder so user doesn't have to remember filenames */}
                {GLOB_PDFS.length > 0 && (
                  <div className="pt-1.5 pb-0.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      File rilevati nella cartella (Clicca per inserire):
                    </p>
                    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {GLOB_PDFS.map((g) => (
                        <button
                          key={g.name}
                          onClick={() => {
                            setConnectFileName(g.name);
                            // Auto trigger connection
                            setTimeout(() => {
                              const newPdf: PDFAttachment = {
                                name: g.name,
                                size: 0,
                                url: `/pdfs/${g.name}`,
                                isFromPublicPdfs: true
                              };
                              setPdfs(prev => {
                                const updated = [newPdf, ...prev.filter(p => p.name !== g.name)];
                                persistPdfMetaList(updated);
                                return updated;
                              });
                              setActivePdf(newPdf);
                              setCurrentPage(1);
                              setExtractedLines([]);
                              setShowConnectModal(false);
                              setConnectFileName("");
                              setTimeout(() => handleLoadPDF(newPdf), 150);
                              showToast(`File "${g.name}" caricato con successo!`);
                            }, 50);
                          }}
                          className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-800 font-medium text-[11px] rounded-lg transition-all border border-slate-200 hover:border-blue-200 cursor-pointer flex items-center justify-between gap-2"
                        >
                          <span className="truncate">📄 {g.name}</span>
                          <span className="text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Apri</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setShowConnectModal(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 font-medium text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleConnectPublicPdf}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium text-xs rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Collega File</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Styled Top Header Area */}
      <header className="bg-white border-b border-slate-200/80 h-16 flex items-center justify-between px-6 sticky top-0 z-30 shrink-0 select-none">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md text-white font-bold text-xl">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold text-slate-800 tracking-tight flex items-center gap-2">
              LinguaRead
              <span className="text-slate-400 font-normal text-xs md:text-sm hidden sm:inline">| Lettura & Studio Offline</span>
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPdf}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-xs font-semibold rounded-xl shadow-md cursor-pointer transition-all duration-150 hover:-translate-y-0.5"
            title="Importa un PDF dal PC"
          >
            {uploadingPdf ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span className="hidden xs:inline">Seleziona dal PC</span>
          </button>

          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-slate-800 text-slate-100 hover:bg-slate-700 text-xs font-semibold rounded-xl shadow-md cursor-pointer transition-all duration-150 hover:-translate-y-0.5 border border-slate-700"
            title="Collega da cartella public/pdfs"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Collega da public/pdfs</span>
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
        
        {/* Leftmost Sidebar - File List / Library */}
        <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white p-4.5 flex flex-col shrink-0 lg:overflow-y-auto">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">I Miei Libri PDF</p>
            {pdfs.length > 0 && (
              <button
                onClick={handleClearAllLibrary}
                className="text-[10px] text-slate-400 hover:text-red-500 font-semibold cursor-pointer transition-colors"
                title="Svuota elenco"
              >
                Svuota Libreria
              </button>
            )}
          </div>

          {/* List of PDFs */}
          {pdfs.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center bg-slate-50/50 my-1 py-7">
              <FileCheck className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-slate-600">Libreria Vuota</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
                Premi i tasti in alto per collegare i tuoi file da <strong>public/pdfs</strong> o importarli dal computer.
              </p>
            </div>
          ) : (
            <div className="space-y-1 select-none overflow-y-auto max-h-36 lg:max-h-none lg:flex-1 shrink-0 pr-1">
              {pdfs.map((pdf, idx) => {
                const isActive = activePdf?.name === pdf.name;
                
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      handleLoadPDF(pdf);
                      setActiveTabMobile("pdf"); // Switch to PDF screen on tap
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 relative ${
                      isActive 
                        ? "bg-blue-50 border border-blue-100 text-blue-900 shadow-xs" 
                        : "text-slate-600 hover:text-slate-900 text-sm hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden mr-3">
                      <span className={isActive ? "text-blue-600" : "text-slate-400 shrink-0"}>
                        <FileText className="w-4 h-4" />
                      </span>
                      <p className={`text-xs font-bold truncate ${isActive ? "text-blue-900" : "text-slate-700"}`} title={pdf.name}>
                        {pdf.name}
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleDeletePdf(e, pdf.name)}
                      title="Rimuovi"
                      className="opacity-40 hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-slate-100/80 transition-all shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Guide layout helper for user */}
          <div className="hidden lg:block mt-auto pt-4 border-t border-slate-100 shrink-0 text-slate-500 font-sans">
            <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-1.5 mb-1.5 text-xs font-bold text-slate-700">
                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                <span>GUIDA AGGIUNTIVA</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                L'applicazione è interamente <strong>client-side</strong> ed ha elevate performance. Puoi aggiungere i tuoi libri inserendoli nella cartella <code className="font-mono bg-slate-100 text-purple-700 px-1 rounded text-[10px]">public/pdfs</code> del pannello codice, oppure caricandoli direttamente dal PC.
              </p>
            </div>
          </div>
        </aside>

        {/* Tab switcher shown ONLY ON MOBILE (<md) to avoid microscope blocknotes */}
        <div className="md:hidden bg-white border-b border-slate-250 flex select-none shrink-0 font-display">
          <button
            onClick={() => setActiveTabMobile("pdf")}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTabMobile === "pdf"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-400"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Lettore PDF ({activePdf ? "Presente" : "Nessuno"})</span>
          </button>
          <button
            onClick={() => setActiveTabMobile("notes")}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTabMobile === "notes"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-400"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Blocco Appunti ({noteWords} par)</span>
          </button>
        </div>

        {/* Double Workspace Column Sheet */}
        <main className="flex-1 flex flex-col md:flex-row gap-5 p-4 md:p-6 overflow-hidden bg-[#F1F5F9] min-w-0">
          
          {/* LEFT SIDE: PDF Viewer Page Card - ACTIVE ONLY on desktop or when mobile active tab is "pdf" */}
          <section className={`flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm min-w-0 ${
            activeTabMobile === "pdf" ? "flex" : "hidden md:flex"
          }`}>
            {/* Toolbar Header of PDF */}
            <div className="bg-slate-50 border-b border-slate-200/50 px-4 py-3 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2 overflow-hidden mr-3">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs md:text-sm font-bold truncate text-slate-800">
                  {activePdf ? activePdf.name : "Nessun documento attivo"}
                </span>
              </div>

              {/* Page traversal */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => traversePage(-1)}
                  disabled={currentPage <= 1 || !activePdf}
                  className="p-1 text-slate-600 disabled:opacity-30 rounded-lg hover:bg-slate-200 select-none cursor-pointer transition-all"
                  title="Pagina Precedente"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-[11px] text-slate-600 font-bold select-none bg-white px-2.5 py-1 border border-slate-200 rounded-md shadow-xs">
                  {activePdf ? `${currentPage} di ${totalPages}` : "0 di 0"}
                </span>
                <button
                  onClick={() => traversePage(1)}
                  disabled={currentPage >= totalPages || !activePdf}
                  className="p-1 text-slate-600 disabled:opacity-30 rounded-lg hover:bg-slate-200 select-none cursor-pointer transition-all"
                  title="Pagina Successiva"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document display view area */}
            <div className="flex-1 bg-slate-100 border-b border-slate-200/50 overflow-auto flex items-start justify-center p-4 relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-[size:16px_16px] min-h-[300px]">
              {loadingPdf && (
                <div className="absolute inset-0 bg-[#525659]/75 backdrop-blur-xs flex flex-col items-center justify-center z-10 text-white">
                  <RefreshCw className="w-7 h-7 animate-spin text-white mb-2" />
                  <p className="text-xs font-semibold">Lettura della pagina PDF...</p>
                </div>
              )}

              {!activePdf && (
                <div className="text-center py-16 px-6 my-auto text-slate-400 max-w-sm">
                  <Globe2 className="w-10 h-10 text-slate-300 mx-auto mb-2.5 animate-pulse" />
                  <p className="text-xs font-bold text-slate-700">Seleziona un documento</p>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                    Fai clic su un file della tua lista a sinistra, oppure usa i comandi in alto per inserire libri personalizzati dal PC o dalla cartella.
                  </p>
                </div>
              )}

              <canvas
                ref={canvasRef}
                className={`max-w-full shadow-xl rounded-lg bg-white border border-slate-800/10 transition-opacity duration-200 ${
                  activePdf ? "opacity-100" : "opacity-0 invisible h-0"
                }`}
              />
            </div>

            {/* Expansible Extracted text lines from current page */}
            {activePdf && (
              <div className="h-44 bg-slate-50 flex flex-col overflow-hidden shrink-0">
                <div className="bg-slate-150 border-b border-slate-200/50 px-4 py-2 flex items-center justify-between shrink-0 select-none">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-display">
                    <Info className="w-3.5 h-3.5 text-blue-500" /> Testo Rilevato nella Pagina
                  </span>
                  <span className="text-[9px] text-slate-400 hidden xs:inline">
                    Premi il tasto (+) per incollarlo nell'appunti
                  </span>
                </div>

                <div className="p-3 overflow-y-auto space-y-1.5 flex-1">
                  {extractingText ? (
                    <div className="flex items-center justify-center py-4 text-slate-450 space-x-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
                      <span className="text-xs">Rilevamento caratteri della pagina...</span>
                    </div>
                  ) : extractedLines.length === 0 ? (
                    <p className="text-xs text-slate-450 italic text-center py-4">Nessun testo individuato in questa pagina.</p>
                  ) : (
                    extractedLines.map((line, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] leading-relaxed text-slate-600 hover:text-slate-900 bg-white p-2.5 border border-slate-200/60 rounded-xl transition-all flex items-start justify-between gap-3 shadow-xs group"
                      >
                        <p className="flex-1 pr-1 select-text font-sans">{line}</p>
                        
                        {/* Instant click assistance */}
                        <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyLineToClipboard(line)}
                            title="Copia"
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => appendlineToNotes(line)}
                            title="Incolla nel blocco note"
                            className="p-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 cursor-pointer border border-blue-100"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>

          {/* RIGHT SIDE: Notebook Study Notes Sheet - ACTIVE ONLY on desktop or when mobile active tab is "notes" */}
          <section className={`flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm min-w-0 ${
            activeTabMobile === "notes" ? "flex" : "hidden md:flex"
          }`}>
            {/* Header / Titles of Notes Area */}
            <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-slate-50 shrink-0 select-none">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-widest font-display">
                  Blocco Note Studio
                </span>
                <span className="text-[10px] bg-blue-55 text-blue-700 font-bold px-2 py-0.5 rounded-full font-mono">
                  {noteWords} parole
                </span>
                
                {/* Scalatore carattere per migliore visibilità su mobile */}
                <div className="flex items-center bg-slate-200/60 border border-slate-200 rounded-lg p-0.5 ml-1 select-none">
                  <button
                    onClick={() => setNoteFontSize(prev => Math.max(12, prev - 1))}
                    title="Riduci font"
                    className="px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 disabled:opacity-35 cursor-pointer hover:bg-white rounded transition-colors"
                    disabled={noteFontSize <= 12}
                  >
                    A-
                  </button>
                  <span className="text-[10px] px-1.5 font-bold text-slate-600">
                    {noteFontSize}px
                  </span>
                  <button
                    onClick={() => setNoteFontSize(prev => Math.min(24, prev + 1))}
                    title="Incolla font"
                    className="px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 disabled:opacity-35 cursor-pointer hover:bg-white rounded transition-colors"
                    disabled={noteFontSize >= 24}
                  >
                    A+
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={copyAllNotes}
                  title="Copia Tutto"
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shadow-xs hover:text-slate-800 flex items-center gap-1 text-[11px] px-2 cursor-pointer font-bold"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Copia</span>
                </button>
                <button
                  onClick={downloadNotesAsFile}
                  title="Scarica Note (.txt)"
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shadow-xs hover:text-slate-800 flex items-center gap-1 text-[11px] px-2 cursor-pointer font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Salva</span>
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
            <div className="flex-1 flex flex-col min-h-[350px] relative bg-white overflow-hidden">
              {/* Lined Margin */}
              <div className="absolute inset-y-0 pointer-events-none border-l-[1.5px] border-red-200 left-8 z-10" />
              
              {/* Massive input text notes field */}
              <textarea
                value={studyNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Fai clic sul tasto (+) in corrispondenza del testo rilevato in basso a sinistra per inserirlo all'istante o digita liberamente regole, grammatica e coniugazioni."
                className="w-full h-full p-6 pl-12 focus:outline-none text-slate-700 font-sans resize-none z-0 bg-white"
                style={{
                  fontSize: `${noteFontSize}px`,
                  lineHeight: `${noteFontSize * 2}px`,
                  backgroundImage: `linear-gradient(#e2e8f0 1px, transparent 1px)`,
                  backgroundSize: `100% ${noteFontSize * 2}px`,
                  backgroundAttachment: 'local'
                }}
              />
            </div>

            {/* Status footer for paper notes alignment */}
            <div className="bg-slate-50 border-t border-slate-100 px-4 py-2.5 flex items-center justify-between text-[10px] text-slate-400 shrink-0 select-none">
              <span className="font-semibold">Blocco Note Regolato ({noteFontSize}px font / {noteFontSize * 2}px interlinea)</span>
              <span>Allineamento righe attivo</span>
            </div>
          </section>

        </main>

      </div>
    </div>
  );
}
