import { useState, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import PDFViewer from './components/PDFViewer';
import Toolbar from './components/Toolbar';
import { exportPDFWithAnnotations } from './utils/pdfExport';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  const [canvasInstance, setCanvasInstance] = useState(null);
  const [activeTool, setActiveTool] = useState('select');
  const [color, setColor] = useState('#6366f1');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [annotationsMap, setAnnotationsMap] = useState({});
  const [layers, setLayers] = useState([]);
  const [textColor, setTextColor] = useState('#000000');
  const [textFont, setTextFont] = useState('sans-serif');
  const [showSignPad, setShowSignPad] = useState(false);
  
  const pdfViewerRef = useRef(null);
  const signCanvasRef = useRef(null);
  const isDrawingSign = useRef(false);

  const handleSavePDF = async () => {
    if (!pdfDoc) return;
    const name = window.prompt("What file name would you like to use?", "Edited_Project");
    if (name) {
      toast.loading("Exporting your PDF...", { id: 'save' });
      const success = await exportPDFWithAnnotations(pdfDoc, annotationsMap, pageDimensions, name);
      toast.dismiss('save');
      if (success) toast.success("PDF Downloaded!");
    }
  };

  const handleSaveSignature = () => {
    const canvas = signCanvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL();
      pdfViewerRef.current?.insertSignature(dataUrl);
      setShowSignPad(false);
      toast.success("Signature stamped!");
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#050711] text-white overflow-hidden">
      <Toaster position="top-right" />
      
      <header className="p-4 border-b border-white/10 flex justify-between items-center glass-panel z-50 shrink-0">
        <h1 className="text-xl font-black tracking-tighter text-indigo-400 uppercase">Super PDF Editor</h1>
        <div className="flex gap-4">
          <button onClick={() => { setPdfFile(null); setAnnotationsMap({}); }} className="text-[10px] font-black uppercase text-gray-500 hover:text-white transition">New Project</button>
          <input type="file" accept="application/pdf" id="pdf-up" onChange={e => setPdfFile(e.target.files[0])} className="hidden" />
          <label htmlFor="pdf-up" className="px-6 py-2 bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase cursor-pointer hover:scale-105 active:scale-95 transition shadow-lg">Upload PDF</label>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {pdfFile && (
          <Toolbar 
            {...{ activeTool, setActiveTool, color, setColor, strokeWidth, setStrokeWidth, canvasInstance, currentPage, totalPages, layers, textColor, setTextColor, textFont, setTextFont }} 
            onConvertText={() => pdfViewerRef.current?.convertTextToLayers()}
            onImageUpload={(file) => pdfViewerRef.current?.insertImage(file)}
            onRemoveBackground={() => pdfViewerRef.current?.removeImageBackground()}
            onRotateImage={() => pdfViewerRef.current?.rotateSelectedImage()}
            onOpenSignature={() => setShowSignPad(true)}
            onSelectLayer={(obj) => { canvasInstance.setActiveObject(obj); canvasInstance.renderAll(); }}
            onDeleteLayer={(obj) => { canvasInstance.remove(obj); canvasInstance.renderAll(); }}
          />
        )}
        <main className="flex-1 p-4 overflow-hidden h-full flex justify-center">
          {pdfFile ? (
            <PDFViewer ref={pdfViewerRef} {...{ pdfFile, currentPage, setCurrentPage, totalPages, setTotalPages, setPdfDoc, setPageDimensions, activeTool, setActiveTool, color, strokeWidth, annotationsMap, setAnnotationsMap, setCanvasInstance, onUpdateLayers: setLayers, textColor, textFont }} onExportPDF={handleSavePDF} />
          ) : (
            <div className="flex flex-col items-center justify-center opacity-20"><div className="text-[12rem] mb-4">📄</div><h2 className="text-4xl font-black uppercase tracking-tighter">Ready to Start</h2></div>
          )}
        </main>
      </div>

      {/* SIGNATURE MODAL */}
      {showSignPad && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6 text-slate-800">
                <h3 className="text-lg font-black uppercase tracking-tighter">Hand-drawn Sign</h3>
                <button onClick={() => setShowSignPad(false)} className="text-slate-400 hover:text-slate-600"><X/></button>
            </div>
            <canvas 
                ref={signCanvasRef} width={400} height={200} 
                onMouseDown={(e) => { isDrawingSign.current = true; const ctx = signCanvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); }}
                onMouseMove={(e) => { if (isDrawingSign.current) { const ctx = signCanvasRef.current.getContext('2d'); ctx.lineWidth = 3; ctx.lineCap='round'; ctx.strokeStyle='#000'; ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); ctx.stroke(); }}}
                onMouseUp={() => isDrawingSign.current = false}
                className="border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 w-full mb-6 cursor-crosshair"
            />
            <div className="flex gap-3">
              <button onClick={() => signCanvasRef.current.getContext('2d').clearRect(0,0,400,200)} className="flex-1 py-3 text-slate-500 font-bold uppercase text-xs tracking-widest border border-slate-100 rounded-2xl hover:bg-slate-50 transition">Clear</button>
              <button onClick={handleSaveSignature} className="flex-1 py-3 bg-indigo-600 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg hover:bg-indigo-700 transition">Stamp Sign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;