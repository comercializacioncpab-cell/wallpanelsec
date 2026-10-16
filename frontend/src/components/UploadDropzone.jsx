import React, { useRef, useState } from 'react';
import { UploadCloud, Camera, Image as ImageIcon, Sparkles, ShieldCheck, Sun, CheckCircle, Smartphone } from 'lucide-react';

export default function UploadDropzone({ onUploadFile, onLoadDemo, demoRooms = [], isUploading }) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <div className="flex flex-col items-center justify-center max-w-4xl mx-auto py-8 px-4 gap-8">
      {/* Título de bienvenida */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          Transformación de Interiores con IA
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Visualiza Paneles Decorativos en tu Espacio Real
        </h2>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
          Toma una foto con tu celular o sube una imagen de tu sala o dormitorio. Detectamos paredes,
          permitimos retocar con pincel/borrador y proyectamos el panel con iluminación y sombras reales.
        </p>
      </div>

      {/* Input oculto para cámara nativa del celular */}
      <input
        type="file"
        ref={cameraInputRef}
        onChange={(e) => e.target.files?.[0] && onUploadFile(e.target.files[0])}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* Input oculto para galería / archivos */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && onUploadFile(e.target.files[0])}
        accept="image/*"
        className="hidden"
      />

      {/* Botones de acción principales: Cámara y Galería */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md mx-auto">
        {/* Botón Tomar Foto con Cámara Celular */}
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-base shadow-xl shadow-amber-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
        >
          <Camera className="w-5 h-5 stroke-[2.5]" />
          <span>Tomar Foto con la Cámara</span>
        </button>

        {/* Botón Subir desde Galería */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-100 font-semibold text-base border border-slate-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
        >
          <ImageIcon className="w-5 h-5 text-amber-400" />
          <span>Subir desde Galería</span>
        </button>
      </div>

      {/* Zona Drag & Drop para computadoras */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full p-8 rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 text-center group bg-slate-900/40 hover:bg-slate-900/80 ${
          isDragOver
            ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
            : 'border-slate-800 hover:border-amber-500/50'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shadow-inner">
          <UploadCloud className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-white">
            {isUploading ? 'Procesando imagen con IA...' : 'O arrastra una foto aquí desde tu computadora'}
          </p>
          <p className="text-xs text-slate-500">
            JPG, PNG o WEBP (se adapta automáticamente si es vertical u horizontal)
          </p>
        </div>

        {isUploading && (
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Detectando paredes y analizando iluminación...</span>
          </div>
        )}
      </div>

      {/* Habitaciones de prueba (Acceso rápido de un clic) */}
      <div className="w-full space-y-3">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span className="h-px w-12 bg-slate-800"></span>
          <span>O prueba con nuestras habitaciones de muestra hiperrealistas</span>
          <span className="h-px w-12 bg-slate-800"></span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-4xl mx-auto">
          {demoRooms.map((demo) => (
            <button
              key={demo.id}
              onClick={() => onLoadDemo(demo.id)}
              disabled={isUploading}
              className="flex flex-col gap-2.5 p-2.5 rounded-2xl bg-slate-900/60 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer text-left group disabled:opacity-50 shadow-md"
            >
              <div className="w-full h-28 rounded-xl overflow-hidden bg-slate-950 relative">
                <img
                  src={demo.url}
                  alt={demo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity"></div>
              </div>
              <div className="px-1 space-y-0.5">
                <h4 className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors m-0 line-clamp-1">
                  {demo.title}
                </h4>
                <p className="text-[10px] text-slate-400 flex items-center gap-1 m-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Pared lista (1 clic)
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Características clave */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full pt-4 border-t border-slate-900 text-xs">
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/30 border border-slate-800/40">
          <Camera className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-slate-200">Desde tu Celular</span>
            <p className="text-slate-400">Abre la cámara y toma la foto directamente en el lugar del cliente.</p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/30 border border-slate-800/40">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-slate-200">Pincel y Borrador</span>
            <p className="text-slate-400">Suma o resta zonas con el dedo o mouse para precisión milimétrica.</p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/30 border border-slate-800/40">
          <Sun className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-slate-200">Iluminación Real</span>
            <p className="text-slate-400">Mantiene sombras y reflejos naturales de la habitación.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
