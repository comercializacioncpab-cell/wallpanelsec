import React from 'react';
import { Sliders, RotateCw, SunMedium, Sparkles, ZoomIn, Box, Compass } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function TextureControls({
  scale,
  setScale,
  rotation,
  setRotation,
  shadingStrength,
  setShadingStrength,
  is3DActive = false,
  setIs3DActive,
  onOpenPerspectiveTool,
  onApply,
  isProcessing,
  canApply
}) {
  const { t } = useLanguage();

  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 flex flex-col gap-4 w-full shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Control de Escala / Tamaño del panel */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <ZoomIn className="w-4 h-4 text-amber-400" />
            <span>{t('controls.patternSize')}</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0.05"
              max="2.5"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-28 sm:w-36 accent-amber-500 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-amber-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 min-w-14 text-center">
              {scale}x
            </span>
          </div>

          {/* Botones rápidos de tamaño predeterminado */}
          <div className="flex items-center gap-1 text-[11px]">
            <button
              onClick={() => setScale(0.12)}
              className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                scale === 0.12 ? 'bg-amber-500 text-slate-950 font-bold border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {t('controls.ultraFine')}
            </button>
            <button
              onClick={() => setScale(0.25)}
              className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                scale === 0.25 ? 'bg-amber-500 text-slate-950 font-bold border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {t('controls.fine')}
            </button>
            <button
              onClick={() => setScale(0.6)}
              className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                scale === 0.6 ? 'bg-amber-500 text-slate-950 font-bold border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {t('controls.medium')}
            </button>
            <button
              onClick={() => setScale(1.0)}
              className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                scale === 1.0 ? 'bg-amber-500 text-slate-950 font-bold border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {t('controls.standard')}
            </button>
          </div>
        </div>

        {/* Control de Orientación */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-200">{t('controls.orientation')}</span>
          <button
            onClick={() => setRotation(rotation === 0 ? 90 : 0)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5 text-amber-400" />
            <span>{rotation === 0 ? t('controls.vertical') : t('controls.horizontal')}</span>
          </button>
        </div>

        {/* Control de Perspectiva 3D */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (setIs3DActive) setIs3DActive(!is3DActive);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              is3DActive
                ? 'bg-sky-500 text-slate-950 shadow-md scale-[1.02]'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
            title={t('controls.perspectiveTitle')}
          >
            <Box className="w-3.5 h-3.5" />
            <span>{t('controls.perspective3D')} {is3DActive ? t('controls.perspectiveOn') : t('controls.perspectiveOff')}</span>
          </button>

          {is3DActive && onOpenPerspectiveTool && (
            <button
              onClick={onOpenPerspectiveTool}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg border border-sky-500/30 text-xs font-semibold transition-all cursor-pointer"
              title={t('controls.adjustPinsTitle')}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{t('controls.adjustPins')}</span>
            </button>
          )}
        </div>

        {/* Control de Sombras e Iluminación */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <SunMedium className="w-4 h-4 text-amber-400" />
            <span>{t('controls.lightFusion')}</span>
          </div>
          <input
            type="range"
            min="0.3"
            max="2.0"
            step="0.1"
            value={shadingStrength}
            onChange={(e) => setShadingStrength(parseFloat(e.target.value))}
            className="w-24 accent-amber-500 cursor-pointer"
          />
          <span className="text-xs font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
            {Math.round(shadingStrength * 100)}%
          </span>
        </div>

        {/* Botón de Aplicar Transformación */}
        <button
          onClick={onApply}
          disabled={!canApply || isProcessing}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wide"
        >
          <Sparkles className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
          <span>{isProcessing ? t('controls.processingBtn') : t('controls.updateTexture')}</span>
        </button>
      </div>
    </div>
  );
}
