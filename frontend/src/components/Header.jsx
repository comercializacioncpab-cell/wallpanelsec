import React from 'react';
import { Sparkles, Download, RefreshCw } from 'lucide-react';

export default function Header({ onReset, onDownload, hasResult, isProcessing }) {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Logo oficial Wallpanelsec */}
          <div className="flex items-center cursor-pointer" onClick={onReset} title="Wallpanelsec">
            <img
              src="/logo_wallpanelsec.png"
              alt="Wallpanelsec"
              className="h-8 sm:h-9 w-auto object-contain drop-shadow-sm select-none"
            />
          </div>

          <div className="h-5 w-px bg-slate-800 hidden sm:block"></div>

          <div className="hidden md:flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 uppercase tracking-wider">
                <Sparkles className="w-2.5 h-2.5 text-amber-400" /> Visualizador Fotorrealista IA
              </span>
            </div>
            <p className="text-[11px] text-slate-400 m-0">Simulador de Paneles y Revestimientos Decorativos</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {hasResult && (
            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Foto</span>
            </button>
          )}

          <button
            onClick={onReset}
            disabled={isProcessing}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium rounded-xl border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
            title="Cargar otra foto o reiniciar"
          >
            <RefreshCw className={`w-3.5 sm:w-4 h-3.5 sm:h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Nueva Foto</span>
          </button>
        </div>
      </div>
    </header>
  );
}
