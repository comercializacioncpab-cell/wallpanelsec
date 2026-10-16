import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Eye, EyeOff, MoveHorizontal, Smartphone, Monitor, Sparkles, Layers } from 'lucide-react';

export default function BeforeAfterSlider({
  originalSrc,
  transformedSrc,
  panelTitle,
  isProcessing,
  dimensions = { width: 1200, height: 800 },
  orientation = 'horizontal',
  onGoToEdit
}) {
  const [sliderPosition, setSliderPosition] = useState(30); // Mostrar 70% del panel por defecto al llegar
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const isVertical = orientation === 'vertical' || dimensions.height > dimensions.width;

  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pos = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, pos)));
  }, []);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleMove(e.clientX);
  };

  const handleTouchStart = (e) => {
    setIsDragging(true);
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e) => {
      if (isDragging) handleMove(e.clientX);
    };
    const handleTouchMove = (e) => {
      if (isDragging) handleMove(e.touches[0].clientX);
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDragging, handleMove]);

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Barra de estado y botones rápidos */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
        <div className="flex items-center gap-2 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-slate-200 font-semibold">Comparador Fotorrealista:</span>
          <span>Desliza la barra para ver el cambio</span>
        </div>

        {/* Acceso rápido a estados 100% */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSliderPosition(0)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
              sliderPosition <= 5 ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            Ver Solo con Panel
          </button>
          <button
            onClick={() => setSliderPosition(50)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
              sliderPosition > 40 && sliderPosition < 60 ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            Mitad y Mitad
          </button>
          <button
            onClick={() => setSliderPosition(100)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
              sliderPosition >= 95 ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            Ver Solo Original
          </button>

          {onGoToEdit && (
            <button
              onClick={onGoToEdit}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-400 rounded-lg border border-amber-500/30 text-xs font-bold transition-all cursor-pointer ml-1"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Retocar Selección</span>
            </button>
          )}
        </div>
      </div>

      {/* Contenedor con clip-path exacto sin deformación */}
      <div className="flex justify-center w-full bg-slate-950/40 p-2 rounded-2xl">
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{
            aspectRatio: `${dimensions.width} / ${dimensions.height}`,
            maxHeight: isVertical ? 'min(75vh, 720px)' : 'min(66vh, 600px)',
            maxWidth: `min(100%, calc(${isVertical ? 'min(75vh, 720px)' : 'min(66vh, 600px)'} * ${dimensions.width} / ${dimensions.height}))`,
            width: '100%',
            margin: '0 auto'
          }}
          className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl select-none cursor-ew-resize group touch-none shrink-0"
        >
          {/* Capa de imagen transformada (DESPUÉS: abajo completa) */}
          <img
            src={transformedSrc}
            alt="Después con panel decorativo"
            className="absolute inset-0 w-full h-full block pointer-events-none select-none object-contain"
          />

          {/* Capa de imagen original (ANTES: arriba con recorte CSS clip-path perfecto) */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none transition-none"
            style={{
              clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`
            }}
          >
            <img
              src={originalSrc}
              alt="Antes original"
              className="absolute inset-0 w-full h-full block pointer-events-none select-none object-contain"
            />

            {/* Etiqueta ANTES */}
            <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-black/75 backdrop-blur-md text-white text-xs font-black tracking-wider uppercase border border-white/20 shadow-lg pointer-events-none flex items-center gap-1.5 z-10">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              Original (Antes)
            </div>
          </div>

          {/* Etiqueta DESPUÉS */}
          {sliderPosition < 85 && (
            <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-amber-500/90 backdrop-blur-md text-slate-950 text-xs font-black tracking-wider uppercase border border-amber-400/50 shadow-lg pointer-events-none flex items-center gap-1.5 z-10">
              <span className="w-2 h-2 rounded-full bg-slate-950"></span>
              {panelTitle || 'Con Panel Decorativo'}
            </div>
          )}

          {/* Línea divisoria y manija de arrastre */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_15px_rgba(0,0,0,0.8)] cursor-ew-resize z-20 pointer-events-none"
            style={{
              left: `${sliderPosition}%`,
              transition: isDragging ? 'none' : 'left 0.1s ease-out'
            }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-2xl border-2 border-slate-900 group-hover:scale-110 active:scale-95 transition-transform">
              <MoveHorizontal className="w-5 h-5 text-slate-900" />
            </div>
          </div>

          {/* Spinner si está procesando */}
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
              <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
              <p className="text-white font-medium text-sm animate-pulse">
                Calculando iluminación y sombras fotorrealistas...
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 px-2">
        <span>⬅ Foto original</span>
        <span className="font-semibold text-slate-400">Preservando sombras e iluminación real</span>
        <span>Con diseño aplicado ➡</span>
      </div>
    </div>
  );
}
