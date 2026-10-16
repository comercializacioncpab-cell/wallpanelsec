import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import UploadDropzone from './components/UploadDropzone';
import WallSelectorCanvas from './components/WallSelectorCanvas';
import CatalogSidebar from './components/CatalogSidebar';
import TextureControls from './components/TextureControls';
import BeforeAfterSlider from './components/BeforeAfterSlider';
import { useLanguage } from './i18n/LanguageContext';
import { Sparkles, SlidersHorizontal, Layers, CheckCircle2, AlertTriangle, Crop, Smartphone, Monitor, RotateCw } from 'lucide-react';

export default function App() {
  const { t } = useLanguage();
  // Estado de catálogo y demos
  const [panels, setPanels] = useState([]);
  const [demoRooms, setDemoRooms] = useState([]);
  const [selectedPanelId, setSelectedPanelId] = useState('');
  
  // Estado de imagen activa
  const [activeImage, setActiveImage] = useState(null); // { image_id, original_url, dimensions, orientation, aspect_ratio, walls }
  const [selectedWallId, setSelectedWallId] = useState('');
  const [selectedCustomBox, setSelectedCustomBox] = useState(null);
  const [selectedCustomMask, setSelectedCustomMask] = useState(null);
  
  // Estado de transformación / resultado
  const [transformedImage, setTransformedImage] = useState(null);
  const [activeTab, setActiveTab] = useState('compare'); // 'compare' | 'select_wall'
  
  // Parámetros de textura y perspectiva 3D
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [shadingStrength, setShadingStrength] = useState(1.0);
  const [perspectiveQuad, setPerspectiveQuad] = useState(null);
  const [is3DActive, setIs3DActive] = useState(false);
  const [canvasToolMode, setCanvasToolMode] = useState('pen');
  
  // Estados de carga y feedback
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingPanel, setIsUploadingPanel] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Cargar catálogo inicial y demos al montar
  useEffect(() => {
    fetchCatalog();
    fetchDemos();
  }, []);

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/catalog');
      const data = await res.json();
      if (data.panels && data.panels.length > 0) {
        setPanels(data.panels);
        if (!selectedPanelId) {
          setSelectedPanelId(data.panels[0].id);
        }
      }
    } catch (err) {
      console.error('Error cargando catálogo:', err);
    }
  };

  const fetchDemos = async () => {
    try {
      const res = await fetch('/api/demo-rooms');
      const data = await res.json();
      if (data.demos) {
        setDemoRooms(data.demos);
      }
    } catch (err) {
      console.error('Error cargando demos:', err);
    }
  };

  // 2. Subir nueva foto de habitación
  const handleUploadFile = async (file) => {
    setIsUploading(true);
    setErrorMessage('');
    setSelectedCustomBox(null);
    setSelectedCustomMask(null);
    try {
      const compressToPreviewDataUrl = (fileToCompress) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new window.Image();
            img.onload = () => {
              const maxDim = 1200;
              let { width, height } = img;
              if (width > maxDim || height > maxDim) {
                if (width > height) {
                  height = Math.round((height * maxDim) / width);
                  width = maxDim;
                } else {
                  width = Math.round((width * maxDim) / height);
                  height = maxDim;
                }
              }
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => resolve(null);
            img.src = e.target.result;
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(fileToCompress);
        });
      };

      const formData = new FormData();
      formData.append('file', file);

      const [res, localDataUrl] = await Promise.all([
        fetch('/api/upload-room', {
          method: 'POST',
          body: formData,
        }),
        compressToPreviewDataUrl(file)
      ]);

      if (!res.ok) throw new Error('Error al procesar la foto');
      const data = await res.json();
      if (localDataUrl) {
        data.localDataUrl = localDataUrl;
      }
      setupNewImage(data);
    } catch (err) {
      setErrorMessage(err.message || 'Error conectando con el servicio de IA');
    } finally {
      setIsUploading(false);
    }
  };

  // 3. Cargar habitación de demostración
  const handleLoadDemo = async (demoId) => {
    setIsUploading(true);
    setErrorMessage('');
    setSelectedCustomBox(null);
    setSelectedCustomMask(null);
    try {
      const res = await fetch(`/api/load-demo-room/${demoId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Error al cargar la demostración');
      const data = await res.json();
      setupNewImage(data);
    } catch (err) {
      setErrorMessage(err.message || 'Error al cargar la demostración');
    } finally {
      setIsUploading(false);
    }
  };

  // Inicializar estado tras recibir nueva imagen
  const setupNewImage = (imageData) => {
    setActiveImage(imageData);
    setPerspectiveQuad(null);
    setIs3DActive(false);
    setCanvasToolMode('pen');

    if (imageData.is_demo && imageData.initial_mask) {
      // Si viene con una pared pre-detectada limpia (habitaciones de muestra)
      const initialWallId = imageData.walls && imageData.walls.length > 0 ? imageData.walls[0].id : 'wall_1';
      setSelectedWallId(initialWallId);
      setSelectedCustomMask(imageData.initial_mask);
      
      // Disparar renderizado inicial automáticamente para demos
      const panelToUse = selectedPanelId || (panels[0] ? panels[0].id : '');
      if (panelToUse) {
        triggerApplyDecor(imageData.image_id, initialWallId, panelToUse, scale, rotation, shadingStrength, null, null, imageData.initial_mask, null, false);
      }
    } else {
      // Para fotos subidas por el usuario o capturadas con cámara:
      // ¡SIN SELECCIÓN POR DEFECTO! El usuario realiza su propia selección limpia
      setSelectedWallId(null);
      setSelectedCustomMask(null);
      setSelectedCustomBox(null);
      setTransformedImage(null);
      setActiveTab('select_wall');
    }
  };

  // 4. Aplicar diseño a la pared o zona personalizada
  const triggerApplyDecor = async (
    imageId = activeImage?.image_id,
    wallId = selectedWallId,
    panelId = selectedPanelId || (panels.length > 0 ? panels[0].id : ''),
    currentScale = scale,
    currentRot = rotation,
    currentShading = shadingStrength,
    pointCoords = null,
    customBox = selectedCustomBox,
    customMask = selectedCustomMask,
    currentPerspectiveQuad = perspectiveQuad,
    currentIs3D = is3DActive,
    switchToCompare = true
  ) => {
    if (!imageId) return;

    let targetPanelId = panelId;
    if (!targetPanelId && panels.length > 0) {
      targetPanelId = panels[0].id;
      setSelectedPanelId(targetPanelId);
    }
    if (!targetPanelId) {
      setErrorMessage(t('catalog.subtitle'));
      return;
    }

    // Si no hay ninguna pared o máscara seleccionada ni cuadrilátero 3D activo, no renderizar
    if (!wallId && !customMask && !customBox && !pointCoords && (!currentIs3D || !currentPerspectiveQuad)) return;

    setIsProcessing(true);
    setErrorMessage('');
    try {
      const payload = {
        image_id: imageId,
        wall_id: wallId || 'wall_1',
        panel_id: targetPanelId,
        scale: currentScale,
        rotation: currentRot,
        shading_strength: currentShading,
      };

      if (customMask) {
        payload.mask_base64 = customMask;
      } else if (customBox) {
        payload.custom_box = customBox;
      } else if (pointCoords) {
        payload.point_x = pointCoords.x;
        payload.point_y = pointCoords.y;
      }

      if (currentIs3D && currentPerspectiveQuad && currentPerspectiveQuad.length === 4) {
        payload.perspective_quad = currentPerspectiveQuad;
      }

      // 1. Envío ultraligero (JSON de pocos KB para respuesta casi instantánea)
      let res = await fetch('/api/apply-decor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // 2. Si el servidor reinició y perdió la sesión (404), reintentar automáticamente con la foto comprimida
      if (res.status === 404 && activeImage?.localDataUrl) {
        payload.image_base64 = activeImage.localDataUrl;
        res = await fetch('/api/apply-decor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          throw new Error(t('errors.serverWakingUp'));
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || t('errors.renderError'));
      }
      const data = await res.json();
      
      setTransformedImage(data.result_base64 || data.result_url);
      if (switchToCompare) {
        setActiveTab('compare'); // Cambiar a la vista del comparador antes/después
      }
    } catch (err) {
      if (err.name === 'TypeError' || (err.message && err.message.toLowerCase().includes('fetch'))) {
        setErrorMessage(t('errors.serverWakingUp'));
      } else {
        setErrorMessage(err.message || t('errors.renderError'));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Selección de panel en catálogo: renderiza de inmediato manteniendo la máscara del usuario
  const handleSelectPanel = (panelId) => {
    setSelectedPanelId(panelId);
    if (activeImage) {
      if (selectedCustomMask || selectedCustomBox || selectedWallId || (is3DActive && perspectiveQuad)) {
        triggerApplyDecor(
          activeImage.image_id,
          selectedWallId,
          panelId,
          scale,
          rotation,
          shadingStrength,
          null,
          selectedCustomBox,
          selectedCustomMask,
          perspectiveQuad,
          is3DActive,
          activeTab === 'compare' // solo cambiar de tab si ya estaba en compare
        );
      }
    }
  };

  // Selección de pared: limpia recuadro y máscara previa para usar la pared de la IA
  const handleSelectWall = (wallId) => {
    setSelectedWallId(wallId);
    setSelectedCustomBox(null);
    setSelectedCustomMask(null);
    if (activeImage && selectedPanelId) {
      triggerApplyDecor(activeImage.image_id, wallId, selectedPanelId, scale, rotation, shadingStrength, null, null, null, perspectiveQuad, is3DActive);
    }
  };

  // Selección por área o recuadro dibujado por el usuario
  const handleCustomAreaSelect = (box) => {
    setSelectedCustomBox(box);
    setSelectedCustomMask(null);
    if (activeImage && selectedPanelId) {
      triggerApplyDecor(activeImage.image_id, selectedWallId, selectedPanelId, scale, rotation, shadingStrength, null, box, null, perspectiveQuad, is3DActive);
    }
  };

  // Selección por máscara manual con pincel, borrador o pluma
  const handleCustomMaskApply = (maskBase64, switchToCompare = true, quadOverride = null) => {
    setSelectedCustomMask(maskBase64);
    setSelectedCustomBox(null);
    const quadToUse = (quadOverride && quadOverride.length === 4) ? quadOverride : perspectiveQuad;
    const is3DToUse = quadOverride && quadOverride.length === 4 ? true : is3DActive;
    if (activeImage && selectedPanelId) {
      triggerApplyDecor(
        activeImage.image_id,
        selectedWallId,
        selectedPanelId,
        scale,
        rotation,
        shadingStrength,
        null,
        null,
        maskBase64,
        quadToUse,
        is3DToUse,
        switchToCompare
      );
    }
  };

  // Selección por punto en la imagen
  const handlePointClick = (x, y) => {
    setSelectedCustomBox(null);
    setSelectedCustomMask(null);
    if (activeImage && selectedPanelId) {
      triggerApplyDecor(activeImage.image_id, selectedWallId, selectedPanelId, scale, rotation, shadingStrength, { x, y }, null, null);
    }
  };

  // Girar foto 90° en sentido horario
  const handleRotateRoom = async () => {
    if (!activeImage) return;
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const res = await fetch(`/api/rotate-room/${activeImage.image_id}`, { method: 'POST' });
      if (!res.ok) throw new Error('Error al rotar la foto');
      const data = await res.json();
      setupNewImage(data);
    } catch (err) {
      setErrorMessage(err.message || 'Error al rotar la foto');
    } finally {
      setIsProcessing(false);
    }
  };

  // Subir nuevo diseño al catálogo
  const handleUploadNewPanel = async (file) => {
    setIsUploadingPanel(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/catalog/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Error al subir el diseño');
      const data = await res.json();
      await fetchCatalog();
      if (data.panel) {
        setSelectedPanelId(data.panel.id);
        if (activeImage) {
          triggerApplyDecor(activeImage.image_id, selectedWallId, data.panel.id, scale, rotation, shadingStrength, null, selectedCustomBox, selectedCustomMask);
        }
      }
    } catch (err) {
      alert('Error subiendo diseño al catálogo: ' + err.message);
    } finally {
      setIsUploadingPanel(false);
    }
  };

  // Descargar foto procesada
  const handleDownload = () => {
    if (!transformedImage) return;
    const a = document.createElement('a');
    a.href = transformedImage;
    a.download = `wallpanelsec_${activeImage?.orientation || 'foto'}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Reiniciar a la pantalla de subida
  const handleReset = () => {
    setActiveImage(null);
    setTransformedImage(null);
    setSelectedCustomBox(null);
  };

  const currentPanelObj = panels.find((p) => p.id === selectedPanelId);
  const isVertical = activeImage?.orientation === 'vertical' || (activeImage?.dimensions && activeImage.dimensions.height > activeImage.dimensions.width);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header
        onReset={handleReset}
        onDownload={handleDownload}
        hasResult={Boolean(transformedImage)}
        isProcessing={isProcessing || isUploading}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Mensaje de error si ocurre */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {!activeImage ? (
          <UploadDropzone
            onUploadFile={handleUploadFile}
            onLoadDemo={handleLoadDemo}
            demoRooms={demoRooms}
            isUploading={isUploading}
          />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Área Principal de Trabajo (Visualizador y Controles) */}
            <div className="flex-1 flex flex-col gap-4 w-full">
              {/* Selector de Modos de Vista y Detector de Orientación */}
              <div className="flex flex-wrap items-center justify-between bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('compare')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'compare'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t('tabs.compare')}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('select_wall')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'select_wall'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span>{t('tabs.selectWall')}</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 pr-2">
                  <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                    {isVertical ? <Smartphone className="w-3.5 h-3.5 text-amber-400" /> : <Monitor className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{isVertical ? t('tabs.verticalPhoto') : t('tabs.horizontalPhoto')}</span>
                  </span>

                  {/* Botón para rotar la foto 90° */}
                  <button
                    onClick={handleRotateRoom}
                    disabled={isProcessing}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all cursor-pointer font-medium disabled:opacity-50"
                    title={t('tabs.rotate90Title')}
                  >
                    <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('tabs.rotate90')}</span>
                  </button>

                  <span className="hidden sm:inline text-slate-600">|</span>
                  <div className="hidden sm:flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>{t('tabs.panelSelected')} <strong className="text-slate-200">{currentPanelObj?.title || t('tabs.none')}</strong></span>
                  </div>
                </div>
              </div>

              {/* Vista Activa */}
              {activeTab === 'compare' && transformedImage ? (
                <BeforeAfterSlider
                  originalSrc={activeImage.original_url}
                  transformedSrc={transformedImage}
                  panelTitle={currentPanelObj?.title}
                  isProcessing={isProcessing}
                  dimensions={activeImage.dimensions}
                  orientation={activeImage.orientation}
                  onGoToEdit={() => setActiveTab('select_wall')}
                />
              ) : (
                <WallSelectorCanvas
                  imageId={activeImage.image_id}
                  imageUrl={activeImage.original_url}
                  transformedUrl={transformedImage}
                  walls={activeImage.walls || []}
                  selectedWallId={selectedWallId}
                  currentMask={selectedCustomMask}
                  onSelectWall={handleSelectWall}
                  onPointClick={handlePointClick}
                  onCustomAreaSelect={handleCustomAreaSelect}
                  onCustomMaskApply={handleCustomMaskApply}
                  perspectiveQuad={perspectiveQuad}
                  onPerspectiveQuadChange={setPerspectiveQuad}
                  is3DActive={is3DActive}
                  setIs3DActive={setIs3DActive}
                  initialToolMode={canvasToolMode}
                  dimensions={activeImage.dimensions}
                  orientation={activeImage.orientation}
                />
              )}

              {/* Barra de Ajustes de Textura */}
              <TextureControls
                scale={scale}
                setScale={setScale}
                rotation={rotation}
                setRotation={setRotation}
                shadingStrength={shadingStrength}
                setShadingStrength={setShadingStrength}
                is3DActive={is3DActive}
                setIs3DActive={(active) => {
                  setIs3DActive(active);
                  if (activeImage && selectedPanelId) {
                    triggerApplyDecor(
                      activeImage.image_id,
                      selectedWallId,
                      selectedPanelId,
                      scale,
                      rotation,
                      shadingStrength,
                      null,
                      selectedCustomBox,
                      selectedCustomMask,
                      perspectiveQuad,
                      active
                    );
                  }
                }}
                onOpenPerspectiveTool={() => {
                  setActiveTab('select_wall');
                  setCanvasToolMode('perspective');
                }}
                onApply={() =>
                  triggerApplyDecor(
                    activeImage?.image_id,
                    selectedWallId,
                    selectedPanelId,
                    scale,
                    rotation,
                    shadingStrength,
                    null,
                    selectedCustomBox,
                    selectedCustomMask,
                    perspectiveQuad,
                    is3DActive
                  )
                }
                isProcessing={isProcessing}
                canApply={Boolean(activeImage && selectedPanelId)}
              />
            </div>

            {/* Barra Lateral del Catálogo de Paneles */}
            <CatalogSidebar
              panels={panels}
              selectedPanelId={selectedPanelId}
              onSelectPanel={handleSelectPanel}
              onUploadNewPanel={handleUploadNewPanel}
              isUploadingPanel={isUploadingPanel}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 text-center text-xs text-slate-500">
        {t('tabs.footer')}
      </footer>
    </div>
  );
}
