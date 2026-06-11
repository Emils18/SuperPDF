import { useState, useRef, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { UploadCloud, Sparkles, Terminal, ToggleLeft, ToggleRight, X, Eraser } from 'lucide-react';
import PDFViewer from './components/PDFViewer';
import Toolbar from './components/Toolbar';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  
  // Theme and Motion States
  const [gfMode, setGfMode] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Command Console & Sign States
  const [showConsole, setShowConsole] = useState(false);
  const [consoleQuery, setConsoleQuery] = useState('');
  const [showSignPad, setShowSignaturePad] = useState(false);
  const [savedSignatures, setSavedSignatures] = useState([]);

  const [draftHistory, setDraftHistory] = useState([]);
  const [layers, setLayers] = useState([]);
  
  // Shared references
  const [canvasInstance, setCanvasInstance] = useState(null);
  const pdfViewerRef = useRef(null);
  const signCanvasRef = useRef(null);
  const isDrawingSign = useRef(false);

  const [activeTool, setActiveTool] = useState('select');
  const [color, setColor] = useState('#6366f1'); // Modern indigo default
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [annotationsMap, setAnnotationsMap] = useState({});

  // Command console list
  const commands = [
    { label: 'Activate Cursor Selection', cmd: 'select', shortcut: 'S' },
    { label: 'Activate Pen Free Draw', cmd: 'draw', shortcut: 'P' },
    { label: 'Activate Translucent Highlighter', cmd: 'highlight', shortcut: 'H' },
    { id: 'rect', label: 'Draw Custom Rectangle', cmd: 'rectangle', shortcut: 'R' },
    { label: 'Draw Straight Vector Arrow', cmd: 'arrow', shortcut: 'A' },
    { label: 'Place Editable Textbox', cmd: 'text', shortcut: 'T' },
    { label: 'Activate Whiteout Eraser Suite', cmd: 'eraser', shortcut: 'E' },
    { label: 'Clear Current Workspace Annotations', cmd: 'clear', shortcut: 'C' },
    { label: 'Backup Current State Snapshot', cmd: 'snapshot', shortcut: 'Ctrl + S' }
  ];

  // Restore draft histories and e-signs on mount
  useEffect(() => {
    try {
      const cachedHistory = localStorage.getItem('pdf_editor_history_drafts');
      if (cachedHistory) setDraftHistory(JSON.parse(cachedHistory));
      
      const cachedSigns = localStorage.getItem('pdf_editor_signatures');
      if (cachedSigns) setSavedSignatures(JSON.parse(cachedSigns));

      const cachedMotion = localStorage.getItem('pdf_editor_reduce_motion');
      if (cachedMotion) setReduceMotion(JSON.parse(cachedMotion));
    } catch (e) {
      console.warn(e);
    }
  }, []);

  // Listen for Ctrl+K command console trigger
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowConsole(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Auto-save snapshots every 30 seconds
  useEffect(() => {
    const backupInterval = setInterval(() => {
      if (Object.keys(annotationsMap).length > 0) {
        handleSaveSnapshot(true);
      }
    }, 30000);
    return () => clearInterval(backupInterval);
  }, [annotationsMap, pdfFile]);

  // Synchronize color profiles with workspace toggles
  useEffect(() => {
    if (gfMode) {
      setColor('#f43f5e'); // Soft pink
    } else {
      setColor('#6366f1'); // High-contrast indigo
    }
  }, [gfMode]);

  // Execute Command Console query
  const handleExecuteCommand = (cmd) => {
    setShowConsole(false);
    setConsoleQuery('');
    
    if (['select', 'draw', 'highlight', 'rectangle', 'arrow', 'text', 'eraser'].includes(cmd)) {
      setActiveTool(cmd);
      if (canvasInstance) {
        canvasInstance.isDrawingMode = (cmd === 'draw' || cmd === 'highlight' || cmd === 'eraser');
        canvasInstance.selection = (cmd === 'select');
        if (cmd === 'highlight') {
          canvasInstance.freeDrawingBrush.color = 'rgba(253, 224, 71, 0.45)';
          canvasInstance.freeDrawingBrush.width = 18;
        } else if (cmd === 'eraser') {
          canvasInstance.freeDrawingBrush.color = '#ffffff';
          canvasInstance.freeDrawingBrush.width = strokeWidth * 4 + 12;
        } else {
          canvasInstance.freeDrawingBrush.color = color;
          canvasInstance.freeDrawingBrush.width = strokeWidth;
        }
      }
      toast.success(`Switched tool to ${cmd}`);
    } else if (cmd === 'clear') {
      if (canvasInstance) {
        canvasInstance.remove(...canvasInstance.getObjects());
        canvasInstance.renderAll();
        toast.success("Workspace cleared");
      }
    } else if (cmd === 'snapshot') {
      handleSaveSnapshot(false);
    }
  };

  const handleSaveSnapshot = (isAutoSave = false) => {
    try {
      const currentSnapshot = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
        fileName: pdfFile ? pdfFile.name : "Untitled Workspace",
        data: annotationsMap
      };
      const updatedHistory = [currentSnapshot, ...draftHistory].slice(0, 5);
      setDraftHistory(updatedHistory);
      localStorage.setItem('pdf_editor_history_drafts', JSON.stringify(updatedHistory));
      if (isAutoSave) {
        toast.success("Draft backed up automatically!", { id: 'autosave', icon: '💾' });
      } else {
        toast.success("Workspace snap saved!");
      }
    } catch (e) {
      toast.error("Failed to backup current workspace");
    }
  };

  const handleLoadDraft = (draft) => {
    try {
      setAnnotationsMap(draft.data);
      toast.success(`Restored state from ${draft.timestamp}`);
    } catch (e) {
      toast.error("Failed to restore chosen draft state");
    }
  };

  const handleDeleteDraft = (id) => {
    try {
      const filtered = draftHistory.filter(d => d.id !== id);
      setDraftHistory(filtered);
      localStorage.setItem('pdf_editor_history_drafts', JSON.stringify(filtered));
      toast.success("Deleted history snapshot");
    } catch (e) {
      toast.error("Failed to delete draft from history");
    }
  };

  // Layer sidebar management
  const handleSelectLayer = (obj) => {
    if (canvasInstance) {
      canvasInstance.setActiveObject(obj);
      canvasInstance.renderAll();
      toast.success("Layer selected");
    }
  };

  const handleDeleteLayer = (obj) => {
    if (canvasInstance) {
      canvasInstance.remove(obj);
      canvasInstance.discardActiveObject().renderAll();
      toast.success("Layer removed");
    }
  };

  // E-Sign Canvas drawing handlers
  const handleStartSignDrawing = (e) => {
    isDrawingSign.current = true;
    const canvas = signCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleDrawSign = (e) => {
    if (!isDrawingSign.current) return;
    const canvas = signCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = gfMode ? '#f43f5e' : '#6366f1';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleStopSignDrawing = () => {
    isDrawingSign.current = false;
  };

  const handleSaveSignature = () => {
    const canvas = signCanvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL();
      const updated = [dataUrl, ...savedSignatures].slice(0, 8);
      setSavedSignatures(updated);
      localStorage.setItem('pdf_editor_signatures', JSON.stringify(updated));
      setShowSignaturePad(false);
      toast.success("Signature saved! Click it in sidebar to stamp");
    }
  };

  const handleStampSignature = (sig) => {
    if (pdfViewerRef.current) {
      pdfViewerRef.current.insertSignature(sig);
    }
  };

  const handleImageUpload = (file) => {
    if (pdfViewerRef.current) {
      pdfViewerRef.current.insertImage(file);
    }
  };

  const handleRemoveBackground = () => {
    if (pdfViewerRef.current) {
      pdfViewerRef.current.removeImageBackground();
    }
  };

  const handleRotateImage = () => {
    if (pdfViewerRef.current) {
      pdfViewerRef.current.rotateSelectedImage();
    }
  };

  const handleToggleMotion = () => {
    const newVal = !reduceMotion;
    setReduceMotion(newVal);
    localStorage.setItem('pdf_editor_reduce_motion', JSON.stringify(newVal));
    toast.success(newVal ? "Animations disabled" : "Animations enabled");
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 ${
      gfMode 
        ? 'bg-[#fff5f6]' + (reduceMotion ? '' : ' bg-gradient-to-br from-rose-50 via-pink-100 to-amber-50 animate-bg-mesh text-slate-800')
        : 'bg-[#060814]' + (reduceMotion ? '' : ' bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 animate-bg-mesh text-slate-100')
    }`}>
      
      {/* Toast notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: gfMode ? 'rgba(255, 245, 245, 0.95)' : 'rgba(10, 15, 30, 0.9)',
            color: gfMode ? '#be123c' : '#fff',
            backdropFilter: 'blur(12px)',
            border: gfMode ? '1px solid rgba(251, 113, 133, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            fontSize: '13px',
            fontWeight: '600'
          }
        }}
      />

      <header className={`backdrop-blur-md border-b sticky top-0 z-30 transition-colors duration-300 ${
        gfMode ? 'bg-rose-100/40 border-rose-200/50 text-slate-800' : 'bg-slate-950/40 border-white/5 text-white'
      }`}>
        <div className="max-w-7xl mx-auto px-5 py-4 flex justify-between items-center">
          <h1 className={`text-xl font-bold bg-gradient-to-r bg-clip-text text-transparent transition-all duration-300 ${
            gfMode 
              ? 'from-rose-500 via-pink-500 to-amber-500 font-sans' 
              : 'from-indigo-400 via-blue-400 to-cyan-400 font-mono tracking-wider'
          }`}>
            {gfMode ? '🌸 SUPER PDF EDITOR' : '⚡ SUPER PDF EDITOR'}
          </h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleToggleMotion}
              className={`p-2 rounded-xl border flex items-center gap-1 ${
                gfMode ? 'glass-button-gf border-rose-200 text-rose-500' : 'glass-button border-white/10 text-indigo-400'
              }`}
              title="Toggle Background Animations"
            >
              {reduceMotion ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
              <span className="text-[10px] font-bold">Reduce Motion</span>
            </button>
            <button 
              onClick={() => setShowConsole(true)}
              className={`p-2 rounded-xl border flex items-center gap-1 ${
                gfMode ? 'glass-button-gf border-rose-200 text-rose-500' : 'glass-button border-white/10 text-indigo-400'
              }`}
              title="Open Command Console (Ctrl + K)"
            >
              <Terminal size={14} />
              <span className="text-[10px] font-bold">Console</span>
            </button>
            <label className={`cursor-pointer px-4 py-2 rounded-xl transition-all duration-300 hover:scale-[1.03] active:scale-95 text-xs font-semibold text-white shadow-lg ${
              gfMode 
                ? 'bg-gradient-to-r from-pink-400 to-rose-400 shadow-rose-400/25' 
                : 'bg-gradient-to-r from-indigo-500 to-blue-500 shadow-indigo-500/25'
            }`}>
              📄 Upload PDF
              <input 
                type="file" 
                accept="application/pdf" 
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    setPdfFile(e.target.files[0]);
                  }
                }} 
                className="hidden" 
              />
            </label>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {pdfFile && (
          <Toolbar
            activeTool={activeTool} 
            setActiveTool={setActiveTool}
            color={color} 
            setColor={setColor}
            strokeWidth={strokeWidth} 
            setStrokeWidth={setStrokeWidth}
            pdfDoc={pdfDoc} 
            canvasInstance={canvasInstance}
            annotationsMap={annotationsMap} 
            currentPage={currentPage}
            totalPages={totalPages} 
            pageDimensions={pageDimensions}
            onImageUpload={handleImageUpload}
            onRemoveBackground={handleRemoveBackground}
            onRotateImage={handleRotateImage}
            gfMode={gfMode}
            setGfMode={setGfMode}
            draftHistory={draftHistory}
            onSaveSnapshot={() => handleSaveSnapshot(false)}
            onLoadDraft={handleLoadDraft}
            onDeleteDraft={handleDeleteDraft}
            layers={layers}
            onSelectLayer={handleSelectLayer}
            onDeleteLayer={handleDeleteLayer}
            savedSignatures={savedSignatures}
            onOpenSignaturePad={() => setShowSignaturePad(true)}
            onStampSignature={handleStampSignature}
          />
        )}
        <div className="flex-1 overflow-auto p-5 md:p-8 flex justify-center">
          {/* Glowing slow floating background circles */}
          {!reduceMotion && (
            <>
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none animate-aura-pulse"></div>
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-[100px] pointer-events-none animate-aura-pulse"></div>
            </>
          )}

          {pdfFile ? (
            <div className="max-w-4xl w-full">
              <PDFViewer
                ref={pdfViewerRef}
                pdfFile={pdfFile} 
                currentPage={currentPage} 
                setCurrentPage={setCurrentPage}
                totalPages={totalPages} 
                setTotalPages={setTotalPages}
                setPdfDoc={setPdfDoc} 
                setPageDimensions={setPageDimensions}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                color={color} 
                strokeWidth={strokeWidth}
                annotationsMap={annotationsMap} 
                setAnnotationsMap={setAnnotationsMap}
                setCanvasInstance={setCanvasInstance}
                gfMode={gfMode}
                reduceMotion={reduceMotion}
                onUpdateLayers={setLayers}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center relative">
              <div className={`text-center p-8 max-w-sm rounded-3xl transition-all duration-300 ${
                gfMode ? 'glass-panel-gf border border-rose-200' : 'glass-panel'
              } ${reduceMotion ? '' : 'animate-float-gentle'}`}>
                <div className="text-6xl mb-4 animate-bounce">💖</div>
                <p className="text-lg font-bold">SUPER PDF EDITOR</p>
                <p className="text-xs text-gray-400 mt-2">
                  Upload a PDF document to draw, add annotations, write text, or stamp e-signatures.
                </p>
                <label className={`cursor-pointer px-4 py-2 mt-4 inline-flex items-center gap-1.5 rounded-xl transition-all duration-300 hover:scale-[1.03] active:scale-95 text-xs font-semibold text-white shadow-lg ${
                  gfMode 
                    ? 'bg-gradient-to-r from-pink-400 to-rose-400 shadow-rose-400/25' 
                    : 'bg-gradient-to-r from-indigo-500 to-blue-500 shadow-indigo-500/25'
                }`}>
                  <UploadCloud size={14} /> Browse Computer
                  <input 
                    type="file" 
                    accept="application/pdf" 
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setPdfFile(e.target.files[0]);
                      }
                    }} 
                    className="hidden" 
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Command Palette centered HUD modal */}
      {showConsole && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl p-4 border flex flex-col gap-3 ${
            gfMode ? 'bg-rose-50 border-rose-200 text-slate-800' : 'bg-[#0b0f1a] border-white/10 text-white'
          }`}>
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Terminal size={14} /> HUD Console Command
              </span>
              <button onClick={() => setShowConsole(false)} className="p-1 rounded-lg hover:bg-white/5">
                <X size={16} />
              </button>
            </div>
            <input 
              type="text" 
              placeholder="Search or type a command... (e.g. Draw, Eraser)" 
              value={consoleQuery}
              onChange={e => setConsoleQuery(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-none ${
                gfMode ? 'bg-white border-rose-200 text-slate-800' : 'bg-slate-950 border-white/5 text-white'
              }`}
              autoFocus
            />
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {commands
                .filter(c => c.label.toLowerCase().includes(consoleQuery.toLowerCase()))
                .map((c, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExecuteCommand(c.cmd)}
                    className={`w-full px-3 py-2 rounded-xl flex justify-between items-center text-xs text-left ${
                      gfMode ? 'hover:bg-rose-100' : 'hover:bg-white/5'
                    }`}
                  >
                    <span>{c.label}</span>
                    <span className="bg-white/5 px-2 py-0.5 rounded text-[10px] font-mono text-indigo-400">{c.shortcut}</span>
                  </button>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Hand-drawn E-Sign Pad pop-up panel */}
      {showSignPad && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl p-4 border flex flex-col gap-3 ${
            gfMode ? 'bg-rose-50 border-rose-200 text-slate-800' : 'bg-[#0b0f1a] border-white/10 text-white'
          }`}>
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <span className="text-xs font-extrabold uppercase tracking-wider">Draw Signature</span>
              <button onClick={() => setShowSignaturePad(false)} className="p-1 rounded-lg hover:bg-white/5">
                <X size={16} />
              </button>
            </div>
            <canvas 
              ref={signCanvasRef}
              width={352}
              height={180}
              onMouseDown={handleStartSignDrawing}
              onMouseMove={handleDrawSign}
              onMouseUp={handleStopSignDrawing}
              onMouseLeave={handleStopSignDrawing}
              className="bg-white rounded-xl border border-dashed border-gray-300 cursor-crosshair"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const canvas = signCanvasRef.current;
                  const ctx = canvas.getContext('2d');
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                }}
                className="flex-1 py-1.5 rounded-xl border border-gray-300 text-xs font-semibold"
              >
                Clear Pad
              </button>
              <button 
                onClick={handleSaveSignature}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold text-white ${
                  gfMode ? 'bg-rose-500' : 'bg-indigo-500'
                }`}
              >
                Save Signature
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;