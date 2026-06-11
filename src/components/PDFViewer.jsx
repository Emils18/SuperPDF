/* eslint-disable react/prop-types */
import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { fabric } from 'fabric';
import { 
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize, 
  Trash2, ChevronLeft, ChevronRight, FileImage 
} from 'lucide-react';
import toast from 'react-hot-toast';

const PDFViewer = forwardRef(({
  pdfFile,
  currentPage,
  setCurrentPage,
  totalPages,
  setTotalPages,
  setPdfDoc,
  setPageDimensions,
  activeTool,
  setActiveTool,
  color,
  strokeWidth,
  annotationsMap,
  setAnnotationsMap,
  setCanvasInstance,
  gfMode,
  reduceMotion,
  onUpdateLayers
}, ref) => {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  const [thumbnails, setThumbnails] = useState([]);
  const [fade, setFade] = useState(false);
  const fabricInstance = useRef(null);

  // Per-page Undo/Redo stacks
  const historyStacks = useRef({});
  const historyPointers = useRef({});

  // Active parameters
  const toolParamsRef = useRef({ activeTool, color, strokeWidth });
  useEffect(() => {
    toolParamsRef.current = { activeTool, color, strokeWidth };
  }, [activeTool, color, strokeWidth]);

  // 1. Load document
  useEffect(() => {
    if (!pdfFile) return;
    const loadPdf = async () => {
      try {
        setLoading(true);
        const arrayBuffer = await pdfFile.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPdfDocument(doc);
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setZoom(1.0);
        historyStacks.current = {};
        historyPointers.current = {};
        generateThumbnails(doc);
      } catch (err) {
        console.error(err);
        toast.error('Error opening PDF document');
      } finally {
        setLoading(false);
      }
    };
    loadPdf();
  }, [pdfFile]);

  // Generate page thumbnail previews
  const generateThumbnails = async (doc) => {
    try {
      const list = [];
      for (let i = 1; i <= Math.min(doc.numPages, 100); i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.12 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        list.push({ pageNum: i, dataUrl: canvas.toDataURL() });
      }
      setThumbnails(list);
    } catch (e) {
      console.error(e);
    }
  };

  // Expose utilities to parent via React Ref
  useImperativeHandle(ref, () => ({
    getCanvas: () => fabricInstance.current,
    
    insertImage: (file) => {
      const canvas = fabricInstance.current;
      if (!canvas) return;
      const reader = new FileReader();
      reader.onload = (f) => {
        fabric.Image.fromURL(f.target.result, (img) => {
          img.set({
            left: 50,
            top: 50,
            selectable: true,
            hasBorders: true,
            hasControls: true
          });
          img.scaleToWidth(200);
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          saveHistorySnapshot();
        });
      };
      reader.readAsDataURL(file);
      toast.success("Image placed on canvas");
    },

    insertSignature: (dataUrl) => {
      const canvas = fabricInstance.current;
      if (!canvas) return;
      fabric.Image.fromURL(dataUrl, (img) => {
        img.set({
          left: 100,
          top: 100,
          selectable: true,
          hasBorders: true,
          hasControls: true
        });
        img.scaleToWidth(150);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveHistorySnapshot();
        toast.success("Signature stamped onto page!");
      });
    },

    removeImageBackground: () => {
      const canvas = fabricInstance.current;
      if (!canvas) return;
      const activeObj = canvas.getActiveObject();
      if (!activeObj || activeObj.type !== 'image') {
        toast.error("Please select an image layer first");
        return;
      }
      const imgElement = activeObj._element;
      const canvasTemp = document.createElement('canvas');
      canvasTemp.width = imgElement.width;
      canvasTemp.height = imgElement.height;
      const ctx = canvasTemp.getContext('2d');
      ctx.drawImage(imgElement, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvasTemp.width, canvasTemp.height);
      const data = imgData.data;

      // Filter near-white background pixels
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        if (r > 215 && g > 215 && b > 215) {
          data[i+3] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      activeObj.setSrc(canvasTemp.toDataURL(), () => {
        canvas.renderAll();
        saveHistorySnapshot();
        toast.success("Image background removed");
      });
    },

    rotateSelectedImage: () => {
      const canvas = fabricInstance.current;
      if (!canvas) return;
      const activeObj = canvas.getActiveObject();
      if (!activeObj) {
        toast.error("Please select an object to rotate");
        return;
      }
      const currentAngle = activeObj.get('angle') || 0;
      activeObj.set('angle', (currentAngle + 90) % 360);
      activeObj.setCoords();
      canvas.renderAll();
      saveHistorySnapshot();
      toast.success("Object rotated 90°");
    }
  }));

  // Handle Undo-Redo Snapshots
  const saveHistorySnapshot = () => {
    const canvas = fabricInstance.current;
    if (!canvas) return;

    const objects = canvas.getObjects().map(obj => obj.toObject());
    
    if (!historyStacks.current[currentPage]) {
      historyStacks.current[currentPage] = [];
      historyPointers.current[currentPage] = -1;
    }

    const stack = historyStacks.current[currentPage];
    const pointer = historyPointers.current[currentPage];

    const trimmedStack = stack.slice(0, pointer + 1);
    trimmedStack.push(objects);
    
    historyStacks.current[currentPage] = trimmedStack;
    historyPointers.current[currentPage] = trimmedStack.length - 1;

    setAnnotationsMap(prev => ({
      ...prev,
      [currentPage]: objects
    }));

    updateLayersState();
  };

  const handleUndo = () => {
    const pointer = historyPointers.current[currentPage];
    const stack = historyStacks.current[currentPage];
    if (pointer !== undefined && pointer > 0) {
      historyPointers.current[currentPage] = pointer - 1;
      restoreFromState(stack[pointer - 1]);
      toast.success("Undo performed");
    } else {
      toast.error("Nothing to undo");
    }
  };

  const handleRedo = () => {
    const pointer = historyPointers.current[currentPage];
    const stack = historyStacks.current[currentPage];
    if (pointer !== undefined && stack && pointer < stack.length - 1) {
      historyPointers.current[currentPage] = pointer + 1;
      restoreFromState(stack[pointer + 1]);
      toast.success("Redo performed");
    } else {
      toast.error("Nothing to redo");
    }
  };

  const restoreFromState = (state) => {
    const canvas = fabricInstance.current;
    if (!canvas) return;
    canvas.remove(...canvas.getObjects());
    fabric.util.enlivenObjects(state, (objects) => {
      objects.forEach(obj => canvas.add(obj));
      canvas.renderAll();
      setAnnotationsMap(prev => ({
        ...prev,
        [currentPage]: state
      }));
      updateLayersState();
    });
  };

  // Keyboard deletion support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        deleteActiveObject();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage]);

  const deleteActiveObject = () => {
    const canvas = fabricInstance.current;
    if (canvas) {
      const active = canvas.getActiveObject();
      if (active) {
        canvas.remove(active);
        canvas.discardActiveObject().renderAll();
        saveHistorySnapshot();
        toast.success("Deleted active object");
      }
    }
  };

  // Dispatch current elements mapping to Active Layers Sidebar
  const updateLayersState = () => {
    const canvas = fabricInstance.current;
    if (!canvas) return;
    const items = canvas.getObjects().map((obj, index) => {
      let title = `Layer ${index + 1}: ${obj.type.toUpperCase()}`;
      if (obj.type === 'textbox' || obj.type === 'i-text') {
        title = `Text: "${obj.text.substring(0, 10)}${obj.text.length > 10 ? '...' : ''}"`;
      } else if (obj.type === 'image') {
        title = `Image File Layer`;
      } else if (obj.type === 'rect') {
        title = `Rectangle Border`;
      }
      return {
        id: obj.id || `layer-${index}-${Date.now()}`,
        title,
        ref: obj
      };
    });
    onUpdateLayers(items);
  };

  // Render loop (Only runs when switching pages or scaling viewport)
  useEffect(() => {
    if (!pdfDocument || !currentPage) return;

    let active = true;
    setLoading(true);
    setFade(false);

    const loadPageFrame = async () => {
      try {
        const page = await pdfDocument.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 * zoom });

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;
        const ctx = tempCanvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        if (!active) return;

        const imageUrl = tempCanvas.toDataURL();
        setPageDimensions({ width: viewport.width, height: viewport.height });

        if (fabricInstance.current) {
          fabricInstance.current.dispose();
          fabricInstance.current = null;
        }

        const container = containerRef.current;
        if (container) container.innerHTML = '';
        else return;

        const canvasEl = document.createElement('canvas');
        container.appendChild(canvasEl);

        const fabricCanvas = new fabric.Canvas(canvasEl, {
          width: viewport.width,
          height: viewport.height,
          preserveObjectStacking: true,
        });

        fabricInstance.current = fabricCanvas;
        setCanvasInstance(fabricCanvas);

        fabricCanvas.setBackgroundImage(imageUrl, () => {
          if (active) {
            fabricCanvas.renderAll();
            setFade(true); // Smoothly fade in content
            updateLayersState();
          }
        }, {
          originX: 'left',
          originY: 'top',
          scaleX: 1,
          scaleY: 1,
        });

        // Restore serialized objects
        const pageObjects = annotationsMap[currentPage];
        if (pageObjects && pageObjects.length > 0) {
          fabric.util.enlivenObjects(pageObjects, (objects) => {
            if (!active) return;
            objects.forEach(obj => fabricCanvas.add(obj));
            fabricCanvas.renderAll();
            updateLayersState();
            
            // Set history seed state
            if (!historyStacks.current[currentPage]) {
              historyStacks.current[currentPage] = [pageObjects];
              historyPointers.current[currentPage] = 0;
            }
          }, 'fabric');
        } else {
          // Initialize history stack
          if (!historyStacks.current[currentPage]) {
            historyStacks.current[currentPage] = [[]];
            historyPointers.current[currentPage] = 0;
          }
        }

        const onAnnotationUpdate = () => {
          if (!active) return;
          saveHistorySnapshot();
        };

        fabricCanvas.on('object:added', onAnnotationUpdate);
        fabricCanvas.on('object:removed', onAnnotationUpdate);
        fabricCanvas.on('object:modified', onAnnotationUpdate);

      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPageFrame();

    return () => {
      active = false;
      if (fabricInstance.current) {
        fabricInstance.current.dispose();
        fabricInstance.current = null;
      }
    };
  }, [pdfDocument, currentPage, zoom]);

  // Clean listeners and dynamically bind the active tool's handlers
  useEffect(() => {
    const canvas = fabricInstance.current;
    if (!canvas) return;

    // Remove any previous events to prevent duplicates or interference
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = 'default';

    // Disable object selection unless "Select" or "Eraser" tool is active
    canvas.getObjects().forEach(obj => {
      obj.selectable = (activeTool === 'select');
      obj.evented = (activeTool === 'select' || activeTool === 'eraser');
    });

    if (activeTool === 'draw') {
      canvas.isDrawingMode = true;
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = color;
        canvas.freeDrawingBrush.width = strokeWidth;
      }
    } 
    else if (activeTool === 'highlight') {
      canvas.isDrawingMode = true;
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = 'rgba(253, 224, 71, 0.45)'; // Translucent yellow
        canvas.freeDrawingBrush.width = strokeWidth * 4 + 10;
      }
    } 
    else if (activeTool === 'eraser') {
      // 1. PDF Background Whiteout (draw white lines over underlying PDF content)
      canvas.isDrawingMode = true;
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = '#ffffff'; // Paints over PDF background
        canvas.freeDrawingBrush.width = strokeWidth * 4 + 12;
      }

      // 2. Layer Eraser (click to remove shape/text annotations)
      canvas.on('mouse:down', (options) => {
        if (options.target) {
          canvas.remove(options.target);
          canvas.discardActiveObject().renderAll();
          saveHistorySnapshot();
          toast.success("Erased shape annotation");
        }
      });
    } 
    else if (activeTool === 'select') {
      canvas.selection = true;
      canvas.defaultCursor = 'default';
    } 
    else if (activeTool === 'rectangle') {
      canvas.defaultCursor = 'crosshair';
      let isMouseDown = false;
      let rect = null;
      let origX = 0, origY = 0;

      canvas.on('mouse:down', (options) => {
        if (canvas.getActiveObject()) return; // Don't draw if adjusting a shape

        isMouseDown = true;
        const pointer = canvas.getPointer(options.e);
        origX = pointer.x;
        origY = pointer.y;

        rect = new fabric.Rect({
          left: origX,
          top: origY,
          width: 0,
          height: 0,
          fill: 'transparent',
          stroke: color,
          strokeWidth: strokeWidth,
          selectable: true,
          hasBorders: true,
          hasControls: true
        });
        canvas.add(rect);
        canvas.setActiveObject(rect);
        canvas.renderAll();
      });

      canvas.on('mouse:move', (options) => {
        if (!isMouseDown || !rect) return;
        const pointer = canvas.getPointer(options.e);

        const left = Math.min(origX, pointer.x);
        const top = Math.min(origY, pointer.y);
        const width = Math.abs(origX - pointer.x);
        const height = Math.abs(origY - pointer.y);

        rect.set({ left, top, width, height });
        canvas.renderAll();
      });

      canvas.on('mouse:up', () => {
        if (isMouseDown) {
          isMouseDown = false;
          rect = null;
          saveHistorySnapshot();
        }
      });
    } 
    else if (activeTool === 'arrow') {
      canvas.defaultCursor = 'crosshair';
      let isMouseDown = false;
      let lineObj = null;
      let arrowHead = null;
      let origX = 0, origY = 0;

      canvas.on('mouse:down', (options) => {
        if (canvas.getActiveObject()) return;

        isMouseDown = true;
        const pointer = canvas.getPointer(options.e);
        origX = pointer.x;
        origY = pointer.y;

        lineObj = new fabric.Line([origX, origY, origX, origY], {
          stroke: color,
          strokeWidth: strokeWidth,
          selectable: false,
          evented: false
        });

        arrowHead = new fabric.Triangle({
          left: origX,
          top: origY,
          originX: 'center',
          originY: 'center',
          angle: 0,
          width: strokeWidth * 4 + 8,
          height: strokeWidth * 4 + 8,
          fill: color,
          selectable: false,
          evented: false
        });

        canvas.add(lineObj, arrowHead);
        canvas.renderAll();
      });

      canvas.on('mouse:move', (options) => {
        if (!isMouseDown || !lineObj || !arrowHead) return;
        const pointer = canvas.getPointer(options.e);

        lineObj.set({ x2: pointer.x, y2: pointer.y });

        const dx = pointer.x - origX;
        const dy = pointer.y - origY;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

        arrowHead.set({
          left: pointer.x,
          top: pointer.y,
          angle: angle
        });

        canvas.renderAll();
      });

      canvas.on('mouse:up', () => {
        if (isMouseDown) {
          isMouseDown = false;
          if (lineObj && arrowHead) {
            canvas.remove(lineObj, arrowHead);
            const group = new fabric.Group([lineObj, arrowHead], {
              selectable: true,
              hasBorders: true,
              hasControls: true
            });
            canvas.add(group);
            canvas.setActiveObject(group);
            canvas.renderAll();
            saveHistorySnapshot();
          }
          lineObj = null;
          arrowHead = null;
        }
      });
    } 
    else if (activeTool === 'text') {
      canvas.defaultCursor = 'text';

      canvas.on('mouse:down', (options) => {
        if (canvas.getActiveObject()) return;

        const pointer = canvas.getPointer(options.e);
        const textbox = new fabric.Textbox('Double click to edit', {
          left: pointer.x,
          top: pointer.y,
          width: 180,
          fontSize: 20,
          fill: color,
          fontFamily: 'sans-serif',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderColor: color,
          editingBorderColor: color,
          cornerColor: color,
          cornerSize: 8,
          transparentCorners: false,
          selectable: true,
          hasBorders: true,
          hasControls: true
        });

        canvas.add(textbox);
        canvas.setActiveObject(textbox);
        canvas.renderAll();
        saveHistorySnapshot();

        // Switch automatically to select tool for immediate typing/manipulation
        setActiveTool('select');
      });
    }

    canvas.renderAll();
  }, [activeTool, color, strokeWidth]);

  // PNG Export Current Page
  const saveAsPNG = () => {
    const canvas = fabricInstance.current;
    if (!canvas) return;
    const url = canvas.toDataURL({ format: 'png', quality: 1.0 });
    const link = document.createElement('a');
    link.download = `page_export_${currentPage}.png`;
    link.href = url;
    link.click();
    toast.success("Page exported as PNG image!");
  };

  return (
    <div className={`flex flex-col gap-4 w-full ${reduceMotion ? '' : 'animate-float-gentle'}`}>
      {/* Floating control bar */}
      <div className={`rounded-2xl px-5 py-3 flex flex-wrap justify-between items-center gap-4 transition-all duration-300 ${
        gfMode ? 'glass-panel-gf text-slate-800' : 'glass-panel text-white'
      }`}>
        {/* Navigation buttons */}
        <div className="flex items-center gap-3">
          <button 
            disabled={currentPage <= 1 || loading}
            onClick={() => setCurrentPage(currentPage - 1)}
            className={`p-2 rounded-xl disabled:opacity-30 border ${
              gfMode ? 'glass-button-gf text-rose-500' : 'glass-button'
            }`}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold tracking-wider">Page {currentPage} / {totalPages || 1}</span>
          <button 
            disabled={currentPage >= totalPages || loading}
            onClick={() => setCurrentPage(currentPage + 1)}
            className={`p-2 rounded-xl disabled:opacity-30 border ${
              gfMode ? 'glass-button-gf text-rose-500' : 'glass-button'
            }`}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Viewport Scale adjustments */}
        <div className={`flex items-center gap-2 border-l pl-4 ${gfMode ? 'border-rose-200' : 'border-white/10'}`}>
          <button 
            onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} 
            className={`p-2 rounded-xl border ${gfMode ? 'glass-button-gf text-rose-500' : 'glass-button'}`}
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-semibold w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button 
            onClick={() => setZoom(z => Math.min(z + 0.1, 3.0))} 
            className={`p-2 rounded-xl border ${gfMode ? 'glass-button-gf text-rose-500' : 'glass-button'}`}
          >
            <ZoomIn size={16} />
          </button>
          <button 
            onClick={() => setZoom(1.0)} 
            className={`p-2 rounded-xl border ${gfMode ? 'glass-button-gf text-rose-500' : 'glass-button'}`} 
            title="Reset Zoom"
          >
            <Maximize size={14} />
          </button>
        </div>

        {/* Undo-Redo & Deletions */}
        <div className={`flex items-center gap-2 border-l pl-4 ${gfMode ? 'border-rose-200' : 'border-white/10'}`}>
          <button 
            onClick={handleUndo} 
            className={`p-2 rounded-xl border ${gfMode ? 'glass-button-gf text-rose-500' : 'glass-button'}`} 
            title="Undo Annotation"
          >
            <Undo2 size={16} />
          </button>
          <button 
            onClick={handleRedo} 
            className={`p-2 rounded-xl border ${gfMode ? 'glass-button-gf text-rose-500' : 'glass-button'}`} 
            title="Redo Annotation"
          >
            <Redo2 size={16} />
          </button>
          <button 
            onClick={deleteActiveObject} 
            className={`p-2 rounded-xl border hover:text-red-400 ${gfMode ? 'glass-button-gf text-rose-500' : 'glass-button'}`} 
            title="Delete Selected"
          >
            <Trash2 size={16} />
          </button>
          <button 
            onClick={saveAsPNG} 
            className={`p-2 rounded-xl border ${gfMode ? 'glass-button-gf text-rose-500' : 'glass-button'}`} 
            title="Export as PNG"
          >
            <FileImage size={16} />
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className={`relative flex justify-center items-start overflow-auto min-h-[450px] p-4 rounded-3xl transition-all duration-300 ${
        gfMode ? 'glass-panel-gf border border-rose-200' : 'glass-panel'
      }`}>
        {loading && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-3xl">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-pink-500/20 animate-pulse"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-pink-500 animate-spin"></div>
            </div>
            <p className="mt-4 text-sm font-semibold tracking-wide text-pink-400">Rendering page...</p>
          </div>
        )}
        <div 
          ref={containerRef} 
          className={`inline-block canvas-glow rounded-xl bg-white overflow-hidden transition-all duration-300 ${
            fade ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.99]'
          }`}
        ></div>
      </div>

      {/* Preview Thumbnail strip */}
      {thumbnails.length > 0 && (
        <div className={`p-4 rounded-2xl mt-2 w-full transition-all duration-300 ${
          gfMode ? 'glass-panel-gf border border-rose-200 text-slate-800' : 'glass-panel'
        }`}>
          <h4 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 px-1">Page Thumbnails</h4>
          <div className="flex gap-3.5 overflow-x-auto py-2.5 px-1 scrollbar-thin">
            {thumbnails.map(thumb => (
              <button
                key={thumb.pageNum}
                onClick={() => setCurrentPage(thumb.pageNum)}
                className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                  currentPage === thumb.pageNum 
                    ? 'border-pink-500 scale-105 shadow-lg shadow-pink-500/20' 
                    : 'border-white/5 hover:border-white/20'
                }`}
              >
                <img src={thumb.dataUrl} alt={`Pg ${thumb.pageNum}`} className="h-20 w-auto object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[10px] text-gray-300 py-0.5 text-center font-semibold">
                  Pg {thumb.pageNum}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

PDFViewer.displayName = 'PDFViewer';
export default PDFViewer;