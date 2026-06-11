/* eslint-disable react/prop-types */
import { useState } from 'react';
import { 
  MousePointer, Pencil, Square, Type, Eraser, 
  Layers, Highlighter, MoveRight, Heart, Cpu,
  Image, Sparkles, RotateCw, Menu, X, Save, Edit3, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Toolbar({ 
  activeTool, 
  setActiveTool, 
  color, 
  setColor, 
  strokeWidth, 
  setStrokeWidth, 
  canvasInstance, 
  annotationsMap, 
  currentPage, 
  totalPages, 
  onImageUpload,
  onRemoveBackground,
  onRotateImage,
  gfMode,
  setGfMode,
  draftHistory,
  onSaveSnapshot,
  onLoadDraft,
  onDeleteDraft,
  layers,
  onSelectLayer,
  onDeleteLayer,
  savedSignatures,
  onOpenSignaturePad,
  onStampSignature
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const tools = [
    { id: 'select', label: 'Select Object', desc: 'Move, resize, or delete shapes', icon: MousePointer },
    { id: 'draw', label: 'Pen Draw', desc: 'Draw custom sketches freehand', icon: Pencil },
    { id: 'highlight', label: 'Highlight', desc: 'Highlight sections with transparent yellow', icon: Highlighter },
    { id: 'rectangle', label: 'Rectangle', desc: 'Add border shapes or rectangles', icon: Square },
    { id: 'arrow', label: 'Arrow Line', desc: 'Draw straight arrow lines', icon: MoveRight },
    { id: 'text', label: 'Text Field', desc: 'Click the canvas to add text box', icon: Type },
    { id: 'eraser', label: 'Eraser Suite', desc: 'Scribble to whiteout PDF content, or click any shape to delete', icon: Eraser },
  ];

  const handleToolSelection = (toolId) => {
    setActiveTool(toolId);
    toast.success(`${toolId.charAt(0).toUpperCase() + toolId.slice(1)} tool selected`);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full gap-4">
      {/* App Branding with Mode Swapper */}
      <div className="flex justify-between items-center border-b border-white/5 pb-2">
        <div>
          <h2 className={`text-base font-extrabold transition-all duration-300 ${
            gfMode ? 'text-rose-400 font-sans' : 'text-indigo-400 tracking-wider font-mono'
          }`}>
            {gfMode ? '🌸 SUPER PDF EDITOR' : '⚡ SUPER PDF EDITOR'}
          </h2>
          <p className="text-[8px] uppercase tracking-widest text-gray-400 mt-0.5">
            {gfMode ? 'Sweet Studio Edition' : 'Cybernetic Edition'}
          </p>
        </div>

        <button
          onClick={() => {
            setGfMode(!gfMode);
            toast(
              gfMode ? "Cyber Engine Activated 🌌" : "Kawaii Mode Activated 🌸", 
              { icon: gfMode ? '⚡' : '💝' }
            );
          }}
          className={`p-1.5 rounded-xl transition-all duration-300 border ${
            gfMode ? 'bg-rose-500/10 text-rose-400 border-rose-300/30' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
          }`}
          title="Toggle Aesthetic Profile"
        >
          {gfMode ? <Heart size={14} className="animate-bounce" /> : <Cpu size={14} />}
        </button>
      </div>

      {/* Tool Actions Grid */}
      <div className="space-y-1 overflow-y-auto max-h-[170px] pr-1">
        <label className="text-[9px] text-gray-400 tracking-wider uppercase font-bold block px-1">Canvas Tools</label>
        {tools.map(tool => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <div key={tool.id} className="relative group">
              <button
                onClick={() => handleToolSelection(tool.id)}
                className={`w-full px-3 py-1.5 rounded-xl font-medium transition-all duration-200 flex items-center gap-2.5 ${
                  isActive 
                    ? gfMode
                      ? 'bg-gradient-to-r from-pink-400 to-rose-400 text-white shadow-lg'
                      : 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg' 
                    : gfMode
                      ? 'text-rose-600 hover:bg-rose-500/5 hover:text-rose-600'
                      : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                <Icon size={14} className={isActive ? 'animate-pulse' : 'text-gray-400'} />
                <span className="text-xs">{tool.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Signature Stamping Block */}
      <div className={`p-2.5 rounded-2xl border ${
        gfMode ? 'bg-rose-500/5 border-rose-500/10' : 'bg-white/[0.01] border-white/5'
      }`}>
        <label className="text-[9px] text-gray-400 tracking-wider uppercase font-bold block mb-1">E-Sign Stamps</label>
        {savedSignatures.length === 0 ? (
          <p className="text-[10px] text-gray-500 italic mb-1.5 px-1">No signatures drawn yet.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin">
            {savedSignatures.map((sig, idx) => (
              <button 
                key={idx}
                onClick={() => onStampSignature(sig)}
                className={`shrink-0 h-10 w-16 bg-white rounded-lg border hover:scale-105 transition-all p-1 ${
                  gfMode ? 'border-rose-200' : 'border-white/20'
                }`}
                title="Click to stamp signature"
              >
                <img src={sig} alt="Signature" className="h-full w-full object-contain filter invert" />
              </button>
            ))}
          </div>
        )}
        <button 
          onClick={onOpenSignaturePad}
          className={`w-full py-1 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
            gfMode ? 'glass-button-gf text-rose-500' : 'glass-button text-indigo-400'
          }`}
        >
          <Edit3 size={11} /> Create Signature
        </button>
      </div>

      {/* Photoshop Style Active Layers List */}
      <div className={`p-2.5 rounded-2xl border ${
        gfMode ? 'bg-rose-500/5 border-rose-500/10' : 'bg-white/[0.01] border-white/5'
      }`}>
        <label className="text-[9px] text-gray-400 tracking-wider uppercase font-bold block mb-1.5">Page Layers</label>
        {layers.length === 0 ? (
          <p className="text-[10px] text-gray-500 italic px-1">No layers added on page.</p>
        ) : (
          <div className="space-y-1 max-h-[85px] overflow-y-auto pr-1">
            {layers.map(layer => (
              <div key={layer.id} className={`flex justify-between items-center px-2 py-1 rounded-lg border text-[10px] ${
                gfMode ? 'bg-white/80 border-rose-100' : 'bg-slate-950/40 border-white/5'
              }`}>
                <button 
                  onClick={() => onSelectLayer(layer.ref)}
                  className="font-semibold truncate max-w-[140px] hover:underline text-left text-[10px]"
                >
                  {layer.title}
                </button>
                <button 
                  onClick={() => onDeleteLayer(layer.ref)}
                  className="text-red-400 hover:text-red-300 p-0.5"
                  title="Remove Layer"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saved Draft snapshots */}
      <div className={`p-2.5 rounded-2xl border ${
        gfMode ? 'bg-rose-500/5 border-rose-500/10' : 'bg-white/[0.01] border-white/5'
      }`}>
        <div className="flex justify-between items-center mb-1">
          <label className="text-[9px] text-gray-400 tracking-wider uppercase font-bold block">Draft History (Max 5)</label>
          <button 
            onClick={onSaveSnapshot}
            className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${
              gfMode ? 'glass-button-gf text-rose-500' : 'glass-button text-indigo-400'
            }`}
          >
            <Save size={8} className="inline mr-0.5" /> Save State
          </button>
        </div>
        {draftHistory.length === 0 ? (
          <p className="text-[9px] text-gray-500 italic px-1">No saved snapshots.</p>
        ) : (
          <div className="space-y-1 max-h-[75px] overflow-y-auto pr-1">
            {draftHistory.map(draft => (
              <div key={draft.id} className={`flex justify-between items-center p-1.5 rounded-lg border text-[9px] ${
                gfMode ? 'bg-white/80 border-rose-100 text-slate-800' : 'bg-slate-950/40 border-white/5 text-gray-200'
              }`}>
                <div className="truncate max-w-[110px] text-left">
                  <p className="font-bold truncate">{draft.fileName}</p>
                  <p className="text-[7px] text-gray-500">{draft.timestamp}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button 
                    onClick={() => onLoadDraft(draft)}
                    className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-[8px] font-bold"
                  >
                    Load
                  </button>
                  <button 
                    onClick={() => onDeleteDraft(draft.id)}
                    className="p-0.5 text-red-400 hover:text-red-300"
                  >
                    <X size={8} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Media Suite */}
      <div className={`p-2.5 rounded-2xl border ${
        gfMode ? 'bg-rose-500/5 border-rose-500/10' : 'bg-white/[0.01] border-white/5'
      }`}>
        <div className="grid grid-cols-2 gap-1.5">
          <label className={`flex flex-col items-center justify-center py-1 rounded-xl cursor-pointer text-center text-gray-300 border ${
            gfMode ? 'glass-button-gf text-rose-500' : 'glass-button text-indigo-400'
          }`}>
            <Image size={11} className="mb-0.5" />
            <span className="text-[8px] font-semibold">Add Image</span>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  onImageUpload(e.target.files[0]);
                }
              }} 
            />
          </label>
          <button 
            onClick={onRemoveBackground} 
            className={`flex flex-col items-center justify-center py-1 rounded-xl text-center text-gray-300 border ${
              gfMode ? 'glass-button-gf text-rose-500' : 'glass-button text-indigo-400'
            }`}
          >
            <Sparkles size={11} className="mb-0.5" />
            <span className="text-[8px] font-semibold">DELETE BACKGROUND</span>
          </button>
          <button 
            onClick={onRotateImage} 
            className={`flex flex-col items-center justify-center py-1 rounded-xl text-center text-gray-300 col-span-2 border ${
              gfMode ? 'glass-button-gf text-rose-500' : 'glass-button text-indigo-400'
            }`}
          >
            <RotateCw size={10} className="mb-0.5" />
            <span className="text-[8px] font-semibold">Rotate Image 90°</span>
          </button>
        </div>
      </div>

      {/* Global Metadata */}
      <div className="mt-auto pt-2 border-t border-white/5 text-center flex justify-between items-center text-[9px] text-gray-400">
        <span className="flex items-center gap-1"><Layers size={10} /> Page {currentPage}/{totalPages || 1}</span>
        {gfMode && <span className="bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full text-[8px] font-semibold">GF Mode Active 🌸</span>}
      </div>
    </div>
  );

  return (
    <>
      <div className={`hidden md:flex w-72 h-full flex-col p-4 z-10 shrink-0 ${
        gfMode ? 'glass-panel-gf border-r border-rose-200' : 'glass-panel border-r border-white/10'
      }`}>
        <SidebarContent />
      </div>

      <div className={`md:hidden flex items-center justify-between p-4 border-b sticky top-16 z-20 ${
        gfMode ? 'bg-rose-50 border-rose-200' : 'bg-slate-900/90 border-white/10'
      }`}>
        <span className={`text-sm font-bold ${gfMode ? 'text-rose-500' : 'text-indigo-400'}`}>Control Panel</span>
        <button 
          onClick={() => setMobileOpen(!mobileOpen)} 
          className={`p-1.5 rounded-lg border ${gfMode ? 'glass-button-gf' : 'glass-button'}`}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className={`md:hidden fixed inset-0 z-40 backdrop-blur-2xl p-6 flex flex-col overflow-y-auto ${
          gfMode ? 'bg-rose-50/95 text-slate-800' : 'bg-slate-950/95 text-white'
        }`}>
          <div className="flex justify-end mb-4">
            <button 
              onClick={() => setMobileOpen(false)} 
              className={`p-1.5 rounded-lg border ${gfMode ? 'glass-button-gf' : 'glass-button'}`}
            >
              <X size={20} />
            </button>
          </div>
          <SidebarContent />
        </div>
      )}
    </>
  );
}