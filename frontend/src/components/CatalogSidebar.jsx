import React, { useState, useRef } from 'react';
import { Upload, Check, Sparkles, Filter, PlusCircle, AlertCircle } from 'lucide-react';

export default function CatalogSidebar({
  panels = [],
  selectedPanelId,
  onSelectPanel,
  onUploadNewPanel,
  isUploadingPanel
}) {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const fileInputRef = useRef(null);

  // Obtener categorías únicas
  const categories = ['Todos', ...new Set(panels.map((p) => p.category).filter(Boolean))];

  const filteredPanels = activeCategory === 'Todos'
    ? panels
    : panels.filter((p) => p.category === activeCategory);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadNewPanel(file);
      e.target.value = '';
    }
  };

  return (
    <aside className="w-full lg:w-96 flex flex-col bg-slate-900/60 rounded-2xl border border-slate-800 p-4 gap-4 h-full">
      {/* Cabecera del catálogo */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2 m-0">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Catálogo de Paneles
          </h2>
          <p className="text-xs text-slate-400 m-0">Selecciona el diseño para transformar la pared</p>
        </div>

        {/* Botón para subir nuevos diseños */}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            title="Subir nuevo diseño a la carpeta de paneles"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{isUploadingPanel ? 'Subiendo...' : '+ Añadir'}</span>
          </button>
        </div>
      </div>

      {/* Filtros por Categoría */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all cursor-pointer ${
              activeCategory === cat
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grilla de Paneles */}
      <div className="grid grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
        {filteredPanels.map((panel) => {
          const isSelected = selectedPanelId === panel.id;
          return (
            <div
              key={panel.id}
              onClick={() => onSelectPanel(panel.id)}
              className={`group relative flex flex-col rounded-xl overflow-hidden border transition-all cursor-pointer text-left bg-slate-800/40 hover:bg-slate-800/80 ${
                isSelected
                  ? 'border-amber-400 ring-2 ring-amber-400/30 shadow-lg shadow-amber-500/10 scale-[1.02]'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Imagen del panel */}
              <div className="relative aspect-square w-full bg-slate-950 overflow-hidden">
                <img
                  src={panel.thumbnail_url}
                  alt={panel.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-md">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
                <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[10px] font-medium text-slate-300">
                  {panel.category}
                </span>
              </div>

              {/* Título */}
              <div className="p-2.5">
                <h3 className="text-xs font-semibold text-slate-200 line-clamp-1 group-hover:text-amber-400 transition-colors m-0">
                  {panel.title}
                </h3>
              </div>
            </div>
          );
        })}

        {filteredPanels.length === 0 && (
          <div className="col-span-2 py-8 text-center text-slate-500 text-xs">
            No hay paneles en esta categoría. Puedes subir uno nuevo con el botón de arriba.
          </div>
        )}
      </div>

      {/* Nota informativa */}
      <div className="mt-auto p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <span>
          Cualquier imagen agregada a la carpeta de diseños estará disponible al instante para decorar.
        </span>
      </div>
    </aside>
  );
}
