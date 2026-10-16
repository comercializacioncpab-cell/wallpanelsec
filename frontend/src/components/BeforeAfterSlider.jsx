import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Eye, EyeOff, MoveHorizontal, Smartphone, Monitor, Sparkles, Layers, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function BeforeAfterSlider({
  originalSrc,
  transformedSrc,
  panelTitle,
  isProcessing,
  dimensions = { width: 1200, height: 800 },
  orientation = 'horizontal',
  onGoToEdit
}) {
  const { t } = useLanguage();
  const [sliderPosition, setSliderPosition] = useState(30); // Mostrar 70% del panel por defecto al llegar
  const [isDragging, setIsDragging] = useState(false);
  
  // Estados de Zoom y Desplazamiento (Pan)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);

  const containerRef = useRef(null);
  const pinchStartDistRef = useRef(0);
  const pinchStartCenterRef = useRef({ x: 0, y: 0 });
  const pinchStartZoomRef = useRef(1);
  const pinchStartPanRef = useRef({ x: 0, y: 0 });

  const isVertical = orientation === 'vertical' || dimensions.height > dimensions.width;

  // Cálculo del deslizador compensando el Zoom y el Pan activo
  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width;
    // Mapear clientX a coordenadas locales de la imagen considerando zoom y pan
    const localX = w / 2 + (clientX - rect.left - pan.x - w / 2) / zoom;
    const pos = (localX / w) * 100;
    setSliderPosition(Math.max(0, Math.min(100, pos)));
  }, [zoom, pan]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleMove(e.clientX);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsPinching(false);
      setIsDragging(true);
      handleMove(e.touches[0].clientX);
    } else if (e.touches.length === 2) {
      // Inicio de gesto con 2 dedos: Zoom y Panorámica
      setIsDragging(false);
      setIsPinching(true);
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      pinchStartDistRef.current = dist || 1;
      pinchStartCenterRef.current = {
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2
      };
      pinchStartZoomRef.current = zoom;
      pinchStartPanRef.current = { ...pan };
    }
  };

  // Controles de zoom táctil y botones
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(4.5, prev * 1.35));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(1, prev / 1.35);
      if (next <= 1.05) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e) => {
      if (isDragging) handleMove(e.clientX);
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 2 && isPinching) {
        // Gesto de 2 dedos: pellizcar para zoom + arrastrar para explorar
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const ratio = dist / (pinchStartDistRef.current || 1);
        const nextZoom = Math.max(1, Math.min(4.5, pinchStartZoomRef.current * ratio));

        const center = {
          x: (t0.clientX + t1.clientX) / 2,
          y: (t0.clientY + t1.clientY) / 2
        };
        const dx = center.x - pinchStartCenterRef.current.x;
        const dy = center.y - pinchStartCenterRef.current.y;

        const rect = containerRef.current ? containerRef.current.getBoundingClientRect() : { width: 400, height: 400 };
        const maxPanX = (rect.width * (nextZoom - 1)) / 2;
        const maxPanY = (rect.height * (nextZoom - 1)) / 2;

        const rawPanX = pinchStartPanRef.current.x + dx;
        const rawPanY = pinchStartPanRef.current.y + dy;

        setZoom(nextZoom);
        setPan({
          x: Math.max(-maxPanX, Math.min(maxPanX, rawPanX)),
          y: Math.max(-maxPanY, Math.min(maxPanY, rawPanY))
        });
      } else if (e.touches.length === 1 && isDragging) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length === 0) {
        setIsDragging(false);
        setIsPinching(false);
        if (zoom <= 1.05) {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
      } else if (e.touches.length === 1) {
        setIsPinching(false);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchmove', handleTouchMove);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDragging, isPinching, zoom, handleMove]);

  // Soporte de zoom con rueda de ratón en escritorio
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.88;
        setZoom((prev) => {
          const next = Math.max(1, Math.min(4.5, prev * factor));
          if (next <= 1.05) {
            setPan({ x: 0, y: 0 });
            return 1;
          }
          return next;
        });
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Barra de estado y botones rápidos */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
        <div className="flex items-center gap-2 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-slate-200 font-semibold">{t('slider.photorealisticComparator')}</span>
          <span className="hidden sm:inline">{t('slider.sliderHint')}</span>
        </div>

        {/* Acceso rápido a estados 100% */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSliderPosition(0)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
              sliderPosition <= 5 ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {t('slider.viewOnlyPanel')}
          </button>
          <button
            onClick={() => setSliderPosition(50)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
              sliderPosition > 40 && sliderPosition < 60 ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {t('slider.halfAndHalf')}
          </button>
          <button
            onClick={() => setSliderPosition(100)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
              sliderPosition >= 95 ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {t('slider.viewOnlyOriginal')}
          </button>

          {onGoToEdit && (
            <button
              onClick={onGoToEdit}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-400 rounded-lg border border-amber-500/30 text-xs font-bold transition-all cursor-pointer ml-1"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('slider.refineSelection')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Contenedor interactivo con clip-path exacto y soporte de Zoom con 2 dedos */}
      <div className="flex items-center justify-center w-full bg-slate-950/40 px-3 sm:px-6 py-2.5 rounded-2xl relative">
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{
            aspectRatio: `${dimensions.width} / ${dimensions.height}`,
            maxHeight: isVertical ? 'min(72vh, 680px)' : 'min(62vh, 580px)',
            maxWidth: `min(86%, calc(${isVertical ? 'min(72vh, 680px)' : 'min(62vh, 580px)'} * ${dimensions.width} / ${dimensions.height}))`,
            width: '86%',
            margin: '0 auto'
          }}
          className="relative bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-700/80 shadow-2xl select-none cursor-ew-resize group touch-none shrink-0 sm:w-full sm:max-w-full"
        >
          {/* Capa sincronizada de Zoom y Panorámica (mantiene alineados Antes, Después y la Línea) */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isPinching ? 'none' : 'transform 0.12s ease-out'
            }}
            className="absolute inset-0 w-full h-full pointer-events-none will-change-transform"
          >
            {/* Capa de imagen transformada (DESPUÉS: abajo completa) */}
            <img
              src={transformedSrc}
              alt={t('slider.after')}
              className="absolute inset-0 w-full h-full block select-none object-contain"
            />

            {/* Capa de imagen original (ANTES: arriba con recorte CSS clip-path perfecto) */}
            <div
              className="absolute inset-0 w-full h-full transition-none"
              style={{
                clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`
              }}
            >
              <img
                src={originalSrc}
                alt={t('slider.before')}
                className="absolute inset-0 w-full h-full block select-none object-contain"
              />
            </div>

            {/* Línea divisoria y manija de arrastre sincronizada en el mismo espacio de coordenadas */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_15px_rgba(0,0,0,0.85)] z-20 pointer-events-none"
              style={{
                left: `${sliderPosition}%`,
                transition: isDragging ? 'none' : 'left 0.1s ease-out'
              }}
            >
              <div
                style={{
                  transform: `translate(-50%, -50%) scale(${1 / Math.sqrt(Math.max(1, zoom))})`
                }}
                className="absolute top-1/2 left-1/2 w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-2xl border-2 border-slate-900"
              >
                <MoveHorizontal className="w-5 h-5 text-slate-900" />
              </div>
            </div>
          </div>

          {/* Etiquetas fijas en esquinas (permanecen visibles sin salir de la pantalla al hacer zoom) */}
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-white text-[11px] font-black tracking-wider uppercase border border-white/20 shadow-lg pointer-events-none flex items-center gap-1.5 z-20">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            {t('slider.originalBefore')}
          </div>

          {sliderPosition < 85 && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-amber-500/90 backdrop-blur-md text-slate-950 text-[11px] font-black tracking-wider uppercase border border-amber-400/50 shadow-lg pointer-events-none flex items-center gap-1.5 z-20">
              <span className="w-2 h-2 rounded-full bg-slate-950"></span>
              {panelTitle || t('slider.withPanelTag')}
            </div>
          )}

          {/* Controles flotantes de Zoom interactivo (+, -, 1x / Reset) */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-slate-950/85 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-2xl z-20 text-xs">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomOut();
              }}
              disabled={zoom <= 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white cursor-pointer transition-all active:scale-95"
              title={t('slider.zoomOut')}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleResetZoom();
              }}
              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-mono font-bold cursor-pointer transition-all text-[11px]"
              title={t('slider.resetZoom')}
            >
              {zoom.toFixed(1)}x
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomIn();
              }}
              disabled={zoom >= 4.5}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white cursor-pointer transition-all active:scale-95"
              title={t('slider.zoomIn')}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            {zoom > 1.05 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetZoom();
                }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 cursor-pointer transition-all active:scale-95"
                title={t('slider.resetNormalView')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Banner indicador cuando hay zoom activo */}
          {zoom > 1.05 && (
            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-amber-500/30 text-[11px] text-amber-300 font-medium z-20 pointer-events-none flex items-center gap-1.5 shadow-lg">
              <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
              <span>{t('slider.zoomExploration')}</span>
            </div>
          )}

          {/* Spinner si está procesando */}
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
              <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
              <p className="text-white font-medium text-sm animate-pulse">
                {t('slider.calculating')}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 px-2">
        <span>{t('slider.origPhoto')}</span>
        <span className="font-semibold text-slate-400">{t('slider.shadowNotice')}</span>
        <span>{t('slider.withPanel')}</span>
      </div>
    </div>
  );
}
