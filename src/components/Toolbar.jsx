/* eslint-disable react/prop-types */
import { MousePointer, Pencil, Square, Type, Eraser, Hand, Layers, Highlighter, ScanText, Image, Sparkles, Trash2, RotateCw, PenTool, Layout } from 'lucide-react';

export default function Toolbar({ 
  activeTool, setActiveTool, color, setColor, strokeWidth, setStrokeWidth, 
  layers, onSelectLayer, onDeleteLayer, textColor, setTextColor, textFont, 
  setTextFont, onConvertText, onImageUpload, onRemoveBackground, onRotateImage, onOpenSignature 
}) {
  const tools = [
    { id: 'select', label: 'Select', icon: MousePointer },
    { id: 'pan', label: 'Hand', icon: Hand },
    { id: 'draw', label: 'Pen', icon: Pencil },
    { id: 'highlight', label: 'Marker', icon: Highlighter || Sparkles },
    { id: 'rectangle', label: 'Box', icon: Square },
    { id: 'text', label: 'Type', icon: Type },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
  ];

  const fonts = ['sans-serif', 'serif', 'monospace', 'cursive', 'Georgia', 'Arial', 'Courier New'];

  return (
    <div className="w-72 h-full flex flex-col p-4 shrink-0 gap-4 overflow-y-auto glass-panel border-r border-white/10 z-40">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3 justify-center">
        <Layout className="text-indigo-400" size={18} />
        <h2 className="text-xs font-black uppercase tracking-widest text-white">Editor Console</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {tools.map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)} className={`flex items-center gap-2 p-3 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTool === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <button onClick={onOpenSignature} className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-white/10 transition-all">
        <PenTool size={16} className="text-indigo-400" /> Create Signature
      </button>

      <button onClick={onConvertText} className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
        <ScanText size={16}/> Edit PDF Content
      </button>

      <div className="p-4 rounded-3xl bg-black/40 border border-white/5 space-y-4">
        <div>
          <span className="text-[9px] uppercase font-black text-gray-500 block mb-2 tracking-widest">Typography</span>
          <select value={textFont} onChange={e => setTextFont(e.target.value)} className="w-full bg-slate-900 text-white text-xs p-2 rounded-xl border border-white/10 outline-none">
            {fonts.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="flex justify-between items-center mt-3 px-1">
            <span className="text-[9px] text-gray-400 font-bold uppercase">Text Color</span>
            <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-6 w-10 bg-transparent cursor-pointer rounded" />
          </div>
        </div>
        <div className="border-t border-white/5 pt-3">
          <span className="text-[9px] uppercase font-black text-gray-500 block mb-2 tracking-widest">Pen / Shape</span>
          <div className="flex justify-between items-center px-1">
             <span className="text-[9px] text-gray-400 font-bold uppercase">Stroke</span>
             <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-6 w-10 bg-transparent cursor-pointer rounded" />
          </div>
          <input type="range" min="1" max="20" value={strokeWidth} onChange={e => setStrokeWidth(parseInt(e.target.value))} className="w-full mt-3 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
        </div>
      </div>

      <div className="flex flex-col gap-2 p-4 rounded-3xl bg-black/40 border border-white/5 max-h-48 overflow-hidden shrink-0">
        <span className="text-[9px] uppercase font-black text-gray-500 tracking-widest flex items-center gap-2"><Layers size={12}/> Active Layers ({layers.length})</span>
        <div className="overflow-y-auto space-y-1 pr-1 scrollbar-thin">
          {layers.map((l, i) => (
            <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded-xl text-[9px] text-gray-300 group">
              <span onClick={() => onSelectLayer(l.ref)} className="truncate cursor-pointer hover:text-indigo-400 font-bold">{l.title}</span>
              <Trash2 size={12} className="text-red-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDeleteLayer(l.ref)} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-auto pb-4">
        <label className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer text-white hover:bg-white/10 transition">
          <Image size={18}/><span className="text-[9px] font-black uppercase mt-1">Image</span>
          <input type="file" accept="image/*" className="hidden" onChange={e => onImageUpload(e.target.files[0])} />
        </label>
        <button onClick={onRotateImage} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition">
          <RotateCw size={18}/><span className="text-[9px] font-black uppercase mt-1">Rotate</span>
        </button>
        <button onClick={onRemoveBackground} className="col-span-2 py-2 rounded-2xl bg-white/5 border border-white/10 text-white text-[9px] font-black uppercase hover:text-red-400 transition">Remove Image Background</button>
      </div>
    </div>
  );
}