/* eslint-disable react/prop-types */
import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { fabric } from 'fabric';
import { Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Trash2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import Tesseract from 'tesseract.js'; // REAL OCR ENGINE
import toast from 'react-hot-toast';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const PDFViewer = forwardRef(({
  pdfFile, currentPage, setCurrentPage, totalPages, setTotalPages, setPdfDoc, setPageDimensions, 
  activeTool, setActiveTool, color, strokeWidth, annotationsMap, setAnnotationsMap, 
  setCanvasInstance, onUpdateLayers, textColor, textFont, onExportPDF, setCanvasImages
}, ref) => {
  const containerRef = useRef(null);
  const fabricInstance = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [thumbnails, setThumbnails] = useState([]);
  
  const historyStacks = useRef({});
  const historyPointers = useRef({});
  const isSpacePressed = useRef(false);
  const prevToolBeforeSpace = useRef(null);

  const toolParams = useRef({ activeTool, color, strokeWidth, textColor, textFont });
  useEffect(() => { toolParams.current = { activeTool, color, strokeWidth, textColor, textFont }; }, [activeTool, color, strokeWidth, textColor, textFont]);

  // --- CORE HELPERS ---
  const updateLayersState = () => {
    const canvas = fabricInstance.current;
    if (!canvas) return;
    const items = canvas.getObjects().map((obj, index) => ({
      id: `l-${index}-${Date.now()}`, title: obj.type.toUpperCase(), ref: obj
    }));
    onUpdateLayers(items);
  };

  const saveHistorySnapshot = () => {
    const canvas = fabricInstance.current;
    if (!canvas) return;
    const objects = canvas.getObjects().map(obj => obj.toObject());
    setAnnotationsMap(prev => ({ ...prev, [currentPage]: objects }));
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2.0 });
    setCanvasImages(prev => ({ ...prev, [currentPage]: dataUrl }));
    if (!historyStacks.current[currentPage]) { historyStacks.current[currentPage] = []; historyPointers.current[currentPage] = -1; }
    historyStacks.current[currentPage].push(objects);
    historyPointers.current[currentPage]++;
    updateLayersState();
  };

  const deleteActiveObject = () => {
    const canvas = fabricInstance.current;
    if (canvas && canvas.getActiveObject()) {
      canvas.remove(canvas.getActiveObject());
      canvas.discardActiveObject().renderAll();
      saveHistorySnapshot();
    }
  };

  const handleUndo = () => {
    const p = historyPointers.current[currentPage];
    const s = historyStacks.current[currentPage];
    if (p > 0) {
      historyPointers.current[currentPage]--;
      const state = s[historyPointers.current[currentPage]];
      const canvas = fabricInstance.current;
      canvas.remove(...canvas.getObjects());
      fabric.util.enlivenObjects(state, (objs) => { objs.forEach(o => canvas.add(o)); canvas.renderAll(); updateLayersState(); });
    }
  };

  const handleResetViewport = () => {
    setZoom(1.0);
    if (fabricInstance.current) {
      fabricInstance.current.setViewportTransform([1, 0, 0, 1, 0, 0]);
      fabricInstance.current.renderAll();
      toast.success("View Centered");
    }
  };

  const setupToolListeners = (canvas) => {
    if (!canvas) return;
    canvas.off('mouse:down'); canvas.off('mouse:move'); canvas.off('mouse:up');
    canvas.off('object:modified'); canvas.off('text:changed');
    
    canvas.isDrawingMode = (activeTool === 'draw' || activeTool === 'highlight' || activeTool === 'eraser');
    canvas.selection = (activeTool === 'select');
    canvas.defaultCursor = activeTool === 'pan' ? 'grab' : 'default';

    canvas.on('object:modified', saveHistorySnapshot);
    canvas.on('text:changed', saveHistorySnapshot);

    if (canvas.isDrawingMode && canvas.freeDrawingBrush) {
      if (activeTool === 'eraser') canvas.freeDrawingBrush.color = '#ffffff';
      else if (activeTool === 'highlight') canvas.freeDrawingBrush.color = 'rgba(253, 224, 71, 0.45)';
      else canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = activeTool === 'highlight' ? strokeWidth * 5 : strokeWidth;
    }

    if (activeTool === 'pan') {
      let isPanning = false; let lastX, lastY;
      canvas.on('mouse:down', (e) => { isPanning = true; lastX = e.e.clientX; lastY = e.e.clientY; canvas.defaultCursor = 'grabbing'; });
      canvas.on('mouse:move', (e) => {
        if (!isPanning) return;
        const vpt = [...canvas.viewportTransform];
        vpt[4] += e.e.clientX - lastX; vpt[5] += e.e.clientY - lastY;
        canvas.setViewportTransform(vpt); lastX = e.e.clientX; lastY = e.e.clientY;
      });
      canvas.on('mouse:up', () => { isPanning = false; canvas.defaultCursor = 'grab'; });
    }

    if (activeTool === 'text') {
      canvas.on('mouse:down', (o) => {
        if (canvas.getActiveObject()) return;
        const ptr = canvas.getPointer(o.e);
        const txt = new fabric.Textbox('New Text', { left: ptr.x, top: ptr.y, fontSize: 22, fill: textColor, fontFamily: textFont, width: 150 });
        canvas.add(txt).setActiveObject(txt);
        saveHistorySnapshot(); setActiveTool('select');
      });
    }

    if (activeTool === 'rectangle') {
      let isDown, origX, origY, rect;
      canvas.on('mouse:down', (o) => {
        isDown = true; const ptr = canvas.getPointer(o.e); origX = ptr.x; origY = ptr.y;
        rect = new fabric.Rect({ left: origX, top: origY, width: 0, height: 0, fill: 'transparent', stroke: color, strokeWidth });
        canvas.add(rect);
      });
      canvas.on('mouse:move', (o) => {
        if (!isDown) return; const ptr = canvas.getPointer(o.e);
        rect.set({ left: Math.min(origX, ptr.x), top: Math.min(origY, ptr.y), width: Math.abs(origX - ptr.x), height: Math.abs(origY - ptr.y) });
        canvas.renderAll();
      });
      canvas.on('mouse:up', () => { isDown = false; saveHistorySnapshot(); });
    }
  };

  // --- RENDERING LIFECYCLE ---
  useEffect(() => {
    if (!pdfFile) return;
    (async () => {
      setLoading(true);
      const doc = await pdfjsLib.getDocument({ data: await pdfFile.arrayBuffer() }).promise;
      setPdfDocument(doc); setPdfDoc(doc); setTotalPages(doc.numPages);
      setLoading(false);
    })();
  }, [pdfFile]);

  useEffect(() => {
    if (!pdfDocument) return;
    (async () => {
      setLoading(true);
      const page = await pdfDocument.getPage(currentPage);
      const vp = page.getViewport({ scale: 1.5 * zoom });
      const tempC = document.createElement('canvas'); tempC.width = vp.width; tempC.height = vp.height;
      await page.render({ canvasContext: tempC.getContext('2d'), viewport: vp }).promise;
      setPageDimensions({ width: vp.width, height: vp.height });

      if (fabricInstance.current) fabricInstance.current.dispose();
      const el = document.createElement('canvas');
      if (containerRef.current) {
        containerRef.current.innerHTML = ''; containerRef.current.appendChild(el);
        const fc = new fabric.Canvas(el, { width: vp.width, height: vp.height, preserveObjectStacking: true });
        fabricInstance.current = fc; setCanvasInstance(fc);
        fabric.Image.fromURL(tempC.toDataURL(), (img) => {
          fc.setBackgroundImage(img, fc.renderAll.bind(fc), { originX: 'left', originY: 'top' });
        });
        const saved = annotationsMap[currentPage];
        if (saved) fabric.util.enlivenObjects(saved, (objs) => { objs.forEach(o => fc.add(o)); fc.renderAll(); updateLayersState(); });
        setupToolListeners(fc);
      }
      setLoading(false);
    })();
  }, [pdfDocument, currentPage, zoom]);

  useEffect(() => {
    if (fabricInstance.current) setupToolListeners(fabricInstance.current);
  }, [activeTool, color, strokeWidth, textColor, textFont]);

  // Spacebar Pan Hook
  useEffect(() => {
    const down = (e) => { if (e.key === ' ' && !isSpacePressed.current) { e.preventDefault(); isSpacePressed.current = true; prevToolBeforeSpace.current = activeTool; setActiveTool('pan'); }};
    const up = (e) => { if (e.key === ' ' && isSpacePressed.current) { isSpacePressed.current = false; setActiveTool(prevToolBeforeSpace.current); }};
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [activeTool]);

  useImperativeHandle(ref, () => ({
    getFinalImage: () => fabricInstance.current?.toDataURL({ format: 'png', multiplier: 2.0 }),
    insertImage: (file) => {
      const reader = new FileReader();
      reader.onload = (f) => fabric.Image.fromURL(f.target.result, (img) => {
        img.scaleToWidth(180); fabricInstance.current.add(img).setActiveObject(img).renderAll(); saveHistorySnapshot();
      });
      reader.readAsDataURL(file);
    },
    insertSignature: (dataUrl) => {
        fabric.Image.fromURL(dataUrl, (img) => {
          img.scaleToWidth(150); fabricInstance.current.add(img); fabricInstance.current.setActiveObject(img);
          fabricInstance.current.renderAll(); saveHistorySnapshot();
        });
    },
    rotateSelectedImage: () => {
      const obj = fabricInstance.current?.getActiveObject();
      if (obj) { obj.set('angle', (obj.angle + 90) % 360); obj.setCoords(); fabricInstance.current.renderAll(); saveHistorySnapshot(); }
    },
    convertTextToLayers: async () => {
      if (!pdfDocument || !fabricInstance.current) return;
      setScanning(true);
      setOcrProgress(0);

      try {
        const page = await pdfDocument.getPage(currentPage);
        const textContent = await page.getTextContent();
        const vp = page.getViewport({ scale: 1.5 * zoom });

        // CASE 1: Digital PDF (Standard extraction)
        if (textContent.items.length > 0) {
          textContent.items.forEach(item => {
            if (!item.str.trim()) return;
            const [x, y] = vp.convertToViewportPoint(item.transform[4], item.transform[5]);
            const fs = Math.sqrt(item.transform[0]**2 + item.transform[1]**2) * 1.5 * zoom;
            const mask = new fabric.Rect({ left: x, top: y - fs, width: item.width * 1.5 * zoom, height: fs * 1.2, fill: 'white', selectable: false, evented: false });
            const box = new fabric.Textbox(item.str, { left: x, top: y - fs, fontSize: fs, fill: 'black', width: item.width * 1.5 * zoom + 20 });
            fabricInstance.current.add(mask, box);
          });
          fabricInstance.current.renderAll(); saveHistorySnapshot();
          toast.success("Digital text converted!");
        } 
        // CASE 2: Physical Scanned PDF (Tesseract AI OCR Fallback)
        else {
          toast("Physical scan detected. Launching AI OCR...", { icon: '🤖' });
          const imageToScan = fabricInstance.current.toDataURL({ format: 'png', multiplier: 2 });
          
          const result = await Tesseract.recognize(imageToScan, 'eng', {
            logger: m => { if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100)); }
          });

          result.data.lines.forEach(line => {
            const bbox = line.bbox;
            // Adjust coordinates from high-res OCR scan back to canvas scale
            const x = bbox.x0 / 2;
            const y = bbox.y0 / 2;
            const w = (bbox.x1 - bbox.x0) / 2;
            const h = (bbox.y1 - bbox.y0) / 2;

            const mask = new fabric.Rect({ left: x, top: y, width: w, height: h, fill: 'white', selectable: false, evented: false });
            const box = new fabric.Textbox(line.text, { left: x, top: y, fontSize: h * 0.8, fill: 'black', width: w + 10 });
            fabricInstance.current.add(mask, box);
          });

          fabricInstance.current.renderAll(); saveHistorySnapshot();
          toast.success("AI OCR: Scanned text is now editable!");
        }
      } catch (err) {
        toast.error("OCR Scan Failed");
      } finally { setScanning(false); setOcrProgress(0); }
    }
  }));

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="glass-panel rounded-3xl p-4 flex flex-wrap justify-between items-center gap-4 text-white shadow-2xl shrink-0 mb-4 mx-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} className="p-2 glass-button rounded-xl"><ChevronLeft size={20}/></button>
          <span className="text-[10px] font-black uppercase tracking-widest px-2 text-indigo-400 font-mono">Pg {currentPage} / {totalPages}</span>
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} className="p-2 glass-button rounded-xl"><ChevronRight size={20}/></button>
        </div>
        <div className="flex items-center gap-2 border-l border-white/5 pl-4">
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="p-2 glass-button rounded-xl"><ZoomOut size={18}/></button>
          <button onClick={handleResetViewport} className="p-2 glass-button rounded-xl" title="Reset Viewport"><Maximize size={18}/></button>
          <button onClick={() => setZoom(Math.min(3, zoom + 0.1))} className="p-2 glass-button rounded-xl"><ZoomIn size={18}/></button>
        </div>
        <div className="flex gap-2 border-l border-white/5 pl-4">
          <button onClick={handleUndo} className="p-2 glass-button rounded-xl" title="Undo"><Undo2 size={18}/></button>
          <button onClick={deleteActiveObject} className="p-2 glass-button rounded-xl text-red-500 border-red-500/10"><Trash2 size={18}/></button>
          <button onClick={onExportPDF} className="p-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white font-black px-6 text-xs flex items-center gap-2 uppercase tracking-tighter shadow-lg"><Download size={16}/> Save PDF</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-black/40 rounded-[2.5rem] p-8 flex justify-center items-start custom-scroll relative">
        {(loading || scanning) && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md rounded-xl text-white">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">{scanning ? `AI Scanning: ${ocrProgress}%` : 'Loading Page...'}</p>
          </div>
        )}
        {scanning && <div className="scanner-line" />}
        <div ref={containerRef} className="bg-white shadow-2xl" />
      </div>
    </div>
  );
});

export default PDFViewer;