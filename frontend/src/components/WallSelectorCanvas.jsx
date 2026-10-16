import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  PenTool,
  Paintbrush,
  Eraser,
  Wand2,
  Crop,
  RotateCcw,
  Trash2,
  Check,
  Eye,
  Sparkles,
  Target,
  Undo2,
  X,
  Plus,
  Minus,
  Box,
  Compass,
  Smartphone,
  Move
} from 'lucide-react';

export default function WallSelectorCanvas({
  imageId = null,
  imageUrl,
  transformedUrl = null,
  walls = [],
  selectedWallId,
  currentMask = null,
  onSelectWall,
  onPointClick,
  onCustomAreaSelect,
  onCustomMaskApply,
  perspectiveQuad = null,
  onPerspectiveQuadChange = null,
  is3DActive = false,
  setIs3DActive = null,
  initialToolMode = 'pen',
  dimensions = { width: 1200, height: 800 },
  orientation = 'horizontal'
}) {
  // Herramientas: 'pen' (Pluma Poligonal) | 'brush' | 'eraser' | 'smart_erase' | 'magic_wand' | 'perspective' | 'box_select' | 'auto_wall'
  const [toolMode, setToolMode] = useState(initialToolMode || 'pen');
  const [penMode, setPenMode] = useState('add'); // 'add' | 'subtract'
  const [polyPoints, setPolyPoints] = useState([]); // [{ x, y }]
  const [isHoveringFirstPoint, setIsHoveringFirstPoint] = useState(false);

  const [wandMode, setWandMode] = useState('add'); // 'add' | 'subtract'
  const [wandTolerance, setWandTolerance] = useState(22); // 5 a 50
  const [isWandProcessing, setIsWandProcessing] = useState(false);

  const [brushSliderValue, setBrushSliderValue] = useState(30); // 5 a 100
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorCoords, setCursorCoords] = useState(null); // { x, y } nativas
  const [bgMode, setBgMode] = useState('original'); // 'original' | 'transformed'
  const [boxStart, setBoxStart] = useState(null);
  const [currentBox, setCurrentBox] = useState(null);

  const [isSubtractingFurniture, setIsSubtractingFurniture] = useState(false);
  const [isSmartErasing, setIsSmartErasing] = useState(false);
  const [hasDrawnMask, setHasDrawnMask] = useState(false);

  // Cuadrilátero de perspectiva 3D local [TL, TR, BR, BL]
  const getDefaultQuad = (w, h) => [
    { x: Math.round(w * 0.1), y: Math.round(h * 0.15) },
    { x: Math.round(w * 0.9), y: Math.round(h * 0.15) },
    { x: Math.round(w * 0.9), y: Math.round(h * 0.85) },
    { x: Math.round(w * 0.1), y: Math.round(h * 0.85) }
  ];

  const [localPerspectiveQuad, setLocalPerspectiveQuad] = useState(
    perspectiveQuad && perspectiveQuad.length === 4
      ? perspectiveQuad
      : getDefaultQuad(dimensions.width, dimensions.height)
  );

  const [activePinIndex, setActivePinIndex] = useState(null); // 0, 1, 2, 3
  const [activePolyIndex, setActivePolyIndex] = useState(null); // Índice del vértice poligonal seleccionado/arrastrado
  const [isDraggingPolyPoint, setIsDraggingPolyPoint] = useState(false);
  const pointerDownPosRef = useRef(null);

  const containerRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const lastPointRef = useRef(null);
  const isVertical = orientation === 'vertical' || dimensions.height > dimensions.width;

  // Actualizar modo si el componente padre lo solicita
  useEffect(() => {
    if (initialToolMode) {
      setToolMode(initialToolMode);
    }
  }, [initialToolMode]);

  // Sincronizar cuadrilátero externo si cambia
  useEffect(() => {
    if (perspectiveQuad && perspectiveQuad.length === 4) {
      setLocalPerspectiveQuad(perspectiveQuad);
    }
  }, [perspectiveQuad]);

  // Radio del pincel en coordenadas nativas de la imagen
  const minDimension = Math.min(dimensions.width, dimensions.height);
  const brushRadius = Math.max(4, (brushSliderValue / 100) * (minDimension * 0.16));

  // Inicializar o restaurar canvas de máscara
  useEffect(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    if (currentMask) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasDrawnMask(true);
      };
      img.src = currentMask;
    } else if (selectedWallId) {
      loadWallIntoCanvas(selectedWallId);
      setHasDrawnMask(true);
    } else {
      // Sin máscara ni pared por defecto (foto nueva de usuario): LIENZO LIMPIO
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawnMask(false);
    }
  }, [dimensions.width, dimensions.height, currentMask, selectedWallId]);

  const loadWallIntoCanvas = useCallback((wallId) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const wall = walls.find((w) => w.id === wallId) || walls[0];
    if (wall && wall.polygon && wall.polygon.length >= 3) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
      ctx.beginPath();
      ctx.moveTo(wall.polygon[0].x, wall.polygon[0].y);
      for (let i = 1; i < wall.polygon.length; i++) {
        ctx.lineTo(wall.polygon[i].x, wall.polygon[i].y);
      }
      ctx.closePath();
      ctx.fill();
      setHasDrawnMask(true);
    }
  }, [walls]);

  // CÁLCULO NORMALIZADO 100% EXACTO (0 A DIMENSIONS.WIDTH / HEIGHT)
  const getNativeCoords = (e) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);

    const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    return {
      x: normX * dimensions.width,
      y: normY * dimensions.height
    };
  };

  // Trazo continuo del pincel / borrador
  const drawSegment = (from, to) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (toolMode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
      ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
    }

    ctx.lineWidth = brushRadius * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (from.x === to.x && from.y === to.y) {
      ctx.arc(to.x, to.y, brushRadius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Generar PNG rígido de la máscara sin bordes difusos
  const getRigidMaskPng = (canvas) => {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const alpha = imgData.data[i + 3];
      if (alpha > 40) {
        imgData.data[i] = 245;
        imgData.data[i + 1] = 158;
        imgData.data[i + 2] = 11;
        imgData.data[i + 3] = 180;
      } else {
        imgData.data[i] = 0;
        imgData.data[i + 1] = 0;
        imgData.data[i + 2] = 0;
        imgData.data[i + 3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  };

  // Sincronizar el cuadrilátero 3D directamente con el lienzo de máscara
  const syncQuadToCanvas = useCallback((quad) => {
    const canvas = maskCanvasRef.current;
    if (!canvas || !quad || quad.length !== 4) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    ctx.lineTo(quad[1].x, quad[1].y);
    ctx.lineTo(quad[2].x, quad[2].y);
    ctx.lineTo(quad[3].x, quad[3].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    setHasDrawnMask(true);
    const userMaskPng = getRigidMaskPng(canvas);
    if (onCustomMaskApply) {
      onCustomMaskApply(userMaskPng, false);
    }
  }, [onCustomMaskApply]);

  // Completar y rellenar la Pluma Poligonal (+ calibración de perspectiva automática si tiene 4 puntos)
  const completePolygon = useCallback((points = polyPoints, mode = penMode) => {
    if (!points || points.length < 3) return;
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (mode === 'subtract') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Si tiene exactamente 4 puntos, autocalibrar la Perspectiva 3D con esos 4 vértices ordenados [TL, TR, BR, BL]
    if (points.length === 4) {
      const pts = points.map((p) => ({ x: p.x, y: p.y }));
      const s = pts.map((p) => p.x + p.y);
      const diff = pts.map((p) => p.x - p.y);
      const tl = pts[s.indexOf(Math.min(...s))];
      const br = pts[s.indexOf(Math.max(...s))];
      const tr = pts[diff.indexOf(Math.max(...diff))];
      const bl = pts[diff.indexOf(Math.min(...diff))];
      const quad = [tl, tr, br, bl];
      setLocalPerspectiveQuad(quad);
      if (onPerspectiveQuadChange) onPerspectiveQuadChange(quad);
      if (setIs3DActive) setIs3DActive(true);
    }

    setPolyPoints([]);
    setIsHoveringFirstPoint(false);
    setHasDrawnMask(true);

    // Guardar y aplicar la máscara inmediatamente en el fondo
    const userMaskPng = getRigidMaskPng(canvas);
    if (onCustomMaskApply) {
      onCustomMaskApply(userMaskPng, false);
    }
  }, [polyPoints, penMode, onPerspectiveQuadChange, setIs3DActive, onCustomMaskApply]);

  // Manejo de atajos de teclado para la pluma (Enter, Escape, Backspace)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (toolMode === 'pen') {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (polyPoints.length >= 3) completePolygon();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setPolyPoints([]);
          setIsHoveringFirstPoint(false);
        } else if (e.key === 'Backspace' || (e.ctrlKey && e.key === 'z') || (e.metaKey && e.key === 'z')) {
          e.preventDefault();
          setPolyPoints((prev) => prev.slice(0, -1));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toolMode, polyPoints, completePolygon]);

  // Autoestimar perspectiva desde la máscara o pared activa
  const handleEstimatePerspective = async () => {
    if (!imageId) return;
    try {
      const canvas = maskCanvasRef.current;
      const maskPng = canvas ? canvas.toDataURL('image/png') : null;
      const res = await fetch('/api/estimate-perspective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: imageId,
          mask_base64: maskPng,
          polygon: polyPoints.length >= 4 ? polyPoints : null
        })
      });
      if (!res.ok) throw new Error('Error al estimar perspectiva');
      const data = await res.json();
      if (data.quad && data.quad.length === 4) {
        setLocalPerspectiveQuad(data.quad);
        if (onPerspectiveQuadChange) onPerspectiveQuadChange(data.quad);
        if (setIs3DActive) setIs3DActive(true);
      }
    } catch (err) {
      console.error('Error estimando perspectiva:', err);
    }
  };

  // Clic con la Varita Mágica (con FLOODFILL_FIXED_RANGE y bordes cerrados)
  const handleWandClick = async (pt) => {
    if (!imageId) return;
    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    setIsWandProcessing(true);
    try {
      const maskPng = canvas.toDataURL('image/png');
      const res = await fetch('/api/magic-wand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: imageId,
          seed_x: Math.round(pt.x),
          seed_y: Math.round(pt.y),
          tolerance: wandTolerance,
          mode: wandMode,
          mask_base64: maskPng
        })
      });
      if (!res.ok) throw new Error('Error al procesar varita mágica');
      const data = await res.json();
      if (data.mask_base64) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setHasDrawnMask(true);
        };
        img.src = data.mask_base64;
      }
    } catch (err) {
      console.error('Error con varita mágica:', err);
    } finally {
      setIsWandProcessing(false);
    }
  };

  // Clic para Restar Objeto Específico con GrabCut Inteligente
  const handleSmartObjectErase = async (pt) => {
    if (!imageId) return;
    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    setIsSmartErasing(true);
    try {
      const maskPng = canvas.toDataURL('image/png');
      const res = await fetch('/api/smart-object-erase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: imageId,
          seed_x: Math.round(pt.x),
          seed_y: Math.round(pt.y),
          mode: 'subtract',
          mask_base64: maskPng
        })
      });
      if (!res.ok) throw new Error('Error al restar objeto');
      const data = await res.json();
      if (data.mask_base64) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setHasDrawnMask(true);
        };
        img.src = data.mask_base64;
      }
    } catch (err) {
      console.error('Error with smart object erase:', err);
    } finally {
      setIsSmartErasing(false);
    }
  };

  // Autodetectar y restar muebles / elementos de primer plano con IA
  const handleAutoSubtractFurniture = async () => {
    if (!imageId) return;
    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    setIsSubtractingFurniture(true);
    try {
      const maskPng = canvas.toDataURL('image/png');
      const res = await fetch('/api/auto-subtract-furniture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: imageId,
          mask_base64: maskPng
        })
      });
      if (!res.ok) throw new Error('Error al restar muebles con IA');
      const data = await res.json();
      if (data.mask_base64) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setHasDrawnMask(true);
        };
        img.src = data.mask_base64;
      }
    } catch (err) {
      console.error('Error auto-subtracting furniture:', err);
      alert('Error detectando muebles: ' + err.message);
    } finally {
      setIsSubtractingFurniture(false);
    }
  };

  const handlePointerDown = (e) => {
    // Si es un gesto multitáctil (zoom/pinch con dos dedos), permitir comportamiento nativo del navegador
    if (e.touches && e.touches.length > 1) {
      return;
    }
    e.preventDefault();
    const pt = getNativeCoords(e);

    // Los pines de perspectiva 3D solo se pueden arrastrar en modo 'perspective'
    if (toolMode === 'perspective') {
      const pinHitDist = Math.max(45, dimensions.width * 0.06);
      const pinIndex = localPerspectiveQuad.findIndex((p) => {
        return Math.hypot(pt.x - p.x, pt.y - p.y) < pinHitDist;
      });
      if (pinIndex !== -1) {
        setActivePinIndex(pinIndex);
        return;
      }
    }

    if (toolMode === 'pen') {
      // 1. Verificar si el usuario tocó un punto EXISTENTE para arrastrarlo o corregirlo
      const hitRadius = Math.max(42, dimensions.width * 0.055);
      let foundIndex = -1;
      let minDistance = Infinity;

      for (let i = 0; i < polyPoints.length; i++) {
        const p = polyPoints[i];
        const dist = Math.hypot(pt.x - p.x, pt.y - p.y);
        if (dist <= hitRadius && dist < minDistance) {
          minDistance = dist;
          foundIndex = i;
        }
      }

      if (foundIndex !== -1) {
        // Se tocó un punto existente: activar modo de arrastre/edición
        setActivePolyIndex(foundIndex);
        setIsDraggingPolyPoint(false);
        pointerDownPosRef.current = pt;
        return;
      }

      // 2. Se tocó el lienzo vacío: guardar coordenadas de inicio para diferenciar toque de scroll
      setActivePolyIndex(null);
      setIsDraggingPolyPoint(false);
      pointerDownPosRef.current = pt;
      return;
    }

    if (toolMode === 'smart_erase') {
      handleSmartObjectErase(pt);
      return;
    }

    if (toolMode === 'magic_wand') {
      handleWandClick(pt);
      return;
    }

    if (toolMode === 'brush' || toolMode === 'eraser') {
      setIsDrawing(true);
      lastPointRef.current = pt;
      drawSegment(pt, pt);
      setHasDrawnMask(true);
    } else if (toolMode === 'box_select') {
      setIsDrawing(true);
      setBoxStart(pt);
      setCurrentBox({ x: pt.x, y: pt.y, width: 0, height: 0 });
    }
  };

  const handlePointerMove = (e) => {
    const pt = getNativeCoords(e);
    setCursorCoords(pt);

    // Arrastre interactivo de un pin de perspectiva
    if (activePinIndex !== null) {
      const updatedQuad = [...localPerspectiveQuad];
      updatedQuad[activePinIndex] = { x: Math.round(pt.x), y: Math.round(pt.y) };
      setLocalPerspectiveQuad(updatedQuad);
      if (onPerspectiveQuadChange) onPerspectiveQuadChange(updatedQuad);
      return;
    }

    // Modo Pluma Poligonal
    if (toolMode === 'pen') {
      // Si se está arrastrando/corrigiendo un punto existente
      if (activePolyIndex !== null) {
        setIsDraggingPolyPoint(true);
        setPolyPoints((prev) => {
          const next = [...prev];
          if (next[activePolyIndex]) {
            next[activePolyIndex] = { x: Math.round(pt.x), y: Math.round(pt.y) };
          }
          return next;
        });
        return;
      }

      // Detección de cercanía al primer punto para cerrar el polígono
      if (polyPoints.length >= 3) {
        const p0 = polyPoints[0];
        const hitRadius = Math.max(42, dimensions.width * 0.055);
        const dist = Math.hypot(pt.x - p0.x, pt.y - p0.y);
        setIsHoveringFirstPoint(dist <= hitRadius);
      } else if (isHoveringFirstPoint) {
        setIsHoveringFirstPoint(false);
      }
      return;
    }

    if (!isDrawing) return;

    if (toolMode === 'brush' || toolMode === 'eraser') {
      if (lastPointRef.current) {
        drawSegment(lastPointRef.current, pt);
      }
      lastPointRef.current = pt;
    } else if (toolMode === 'box_select' && boxStart) {
      const x = Math.min(boxStart.x, pt.x);
      const y = Math.min(boxStart.y, pt.y);
      const width = Math.abs(pt.x - boxStart.x);
      const height = Math.abs(pt.y - boxStart.y);
      setCurrentBox({ x, y, width, height });
    }
  };

  const handlePointerUp = (e) => {
    const pt = getNativeCoords(e);

    if (activePinIndex !== null) {
      setActivePinIndex(null);
      syncQuadToCanvas(localPerspectiveQuad);
      return;
    }

    if (toolMode === 'pen') {
      const startPt = pointerDownPosRef.current;
      const wasDragging = isDraggingPolyPoint;
      const touchedIdx = activePolyIndex;

      setActivePolyIndex(null);
      setIsDraggingPolyPoint(false);
      pointerDownPosRef.current = null;

      // Si se estaba arrastrando un punto, ya quedó en su nueva posición corregida
      if (wasDragging) {
        return;
      }

      // Si tocó el primer punto sin arrastrarlo y ya hay 3 o más puntos, cerrar el polígono
      if (touchedIdx === 0 && polyPoints.length >= 3) {
        completePolygon();
        return;
      }

      // Si tocó otro punto existente sin arrastrarlo, no hacer nada (no duplicar puntos)
      if (touchedIdx !== null) {
        return;
      }

      // Si tocó espacio vacío, verificar que haya sido un toque intencional y no un intento de scroll
      if (startPt) {
        const movedDist = Math.hypot(pt.x - startPt.x, pt.y - startPt.y);
        // Umbral de tolerancia: si el dedo se movió más de 30px o 2.5% de la foto, era un deslizamiento de scroll
        const scrollThreshold = Math.max(30, dimensions.width * 0.025);
        if (movedDist < scrollThreshold) {
          // Toque limpio intencional: agregar nuevo punto
          setPolyPoints((prev) => [...prev, pt]);
        }
      }
      return;
    }

    setIsDrawing(false);
    lastPointRef.current = null;

    if (toolMode === 'box_select' && currentBox && currentBox.width > 20 && currentBox.height > 20) {
      const canvas = maskCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
        ctx.fillRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
        setHasDrawnMask(true);
      }
      if (onCustomAreaSelect) {
        onCustomAreaSelect(currentBox);
      }
      setCurrentBox(null);
    }
  };

  const handlePointerLeave = () => {
    if (activePinIndex !== null) {
      setActivePinIndex(null);
      syncQuadToCanvas(localPerspectiveQuad);
    }
    if (toolMode === 'pen') {
      setActivePolyIndex(null);
      setIsDraggingPolyPoint(false);
      pointerDownPosRef.current = null;
    }
    setIsDrawing(false);
    lastPointRef.current = null;
    setCursorCoords(null);
    setIsHoveringFirstPoint(false);
  };

  const handleDoubleClick = (e) => {
    if (toolMode === 'pen' && polyPoints.length >= 3) {
      e.preventDefault();
      completePolygon();
    }
  };

  const handleClear = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setPolyPoints([]);
    setHasDrawnMask(false);
    if (onCustomMaskApply) {
      onCustomMaskApply(null, false);
    }
  };

  const handleResetToAI = () => {
    loadWallIntoCanvas(selectedWallId);
  };

  // Exportar máscara como PNG rígido sin bordes difusos y cambiar a vista comparador
  const handleApply = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const userMaskPng = getRigidMaskPng(canvas);
    if (onCustomMaskApply) {
      onCustomMaskApply(userMaskPng, true);
    }
  };

  const activeBackgroundUrl = bgMode === 'transformed' && transformedUrl ? transformedUrl : imageUrl;

  const pinLabels = [
    { title: 'Techo Izq (TL)', color: '#38bdf8' },
    { title: 'Techo Der (TR)', color: '#38bdf8' },
    { title: 'Suelo Der (BR)', color: '#38bdf8' },
    { title: 'Suelo Izq (BL)', color: '#38bdf8' }
  ];

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Barra de herramientas principal */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 text-xs">
        {/* Selector de modo de herramienta */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 p-1 rounded-xl border border-slate-800">
          {/* Herramienta 1: Pluma Poligonal */}
          <button
            onClick={() => {
              setToolMode('pen');
              setPolyPoints([]);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              toolMode === 'pen'
                ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Pluma Poligonal: Clic a clic en las esquinas de la pared"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Pluma Poligonal</span>
          </button>

          {/* Herramienta 2: Ajuste de Perspectiva 3D */}
          <button
            onClick={() => {
              setToolMode('perspective');
              if (setIs3DActive) setIs3DActive(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              toolMode === 'perspective'
                ? 'bg-sky-500 text-slate-950 shadow-md scale-[1.02]'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Pines de Perspectiva 3D: Arrastra las 4 esquinas para alinear con las líneas de fuga"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Pines 3D (Perspectiva)</span>
          </button>

          {/* Herramienta 3: Pincel Manual */}
          <button
            onClick={() => setToolMode('brush')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              toolMode === 'brush'
                ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Pintar para sumar pared a mano alzada"
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Pincel (+ Sumar)</span>
          </button>

          {/* Herramienta 4: Borrador Manual */}
          <button
            onClick={() => setToolMode('eraser')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              toolMode === 'eraser'
                ? 'bg-red-500 text-white shadow-md scale-[1.02]'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Borrar para restar muebles a mano alzada"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Borrador (- Restar)</span>
          </button>

          {/* Herramienta 5: Clic Restar Objeto (GrabCut) */}
          <button
            onClick={() => setToolMode('smart_erase')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              toolMode === 'smart_erase'
                ? 'bg-rose-500 text-white shadow-md scale-[1.02]'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Restar Objeto al Clic: Haz 1 clic sobre un cuadro, lámpara o cojín para recortarlo"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Restar Objeto</span>
          </button>

          {/* Herramienta 6: Varita Mágica */}
          <button
            onClick={() => setToolMode('magic_wand')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              toolMode === 'magic_wand'
                ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Varita Mágica: Clic en la pared para rellenar respetando los filos"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Varita Mágica</span>
          </button>

          {/* Herramienta 7: Recuadro */}
          <button
            onClick={() => setToolMode('box_select')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              toolMode === 'box_select'
                ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Arrastrar un recuadro de zona"
          >
            <Crop className="w-3.5 h-3.5" />
            <span>Recuadro</span>
          </button>
        </div>

        {/* Sub-barra de controles de la herramienta activa */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Subcontroles de Perspectiva 3D */}
          {toolMode === 'perspective' && (
            <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-sky-500/30">
              <span className="text-sky-300 font-semibold flex items-center gap-1">
                <Box className="w-3.5 h-3.5" />
                <span>4 Pines de Fuga Activos</span>
              </span>

              <button
                onClick={handleEstimatePerspective}
                className="flex items-center gap-1 px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg cursor-pointer transition-all shadow-md"
                title="Ajustar automáticamente los 4 pines a la pared actual"
              >
                <Sparkles className="w-3 h-3 stroke-[2.5]" />
                <span>Auto-detectar Fuga</span>
              </button>

              <button
                onClick={() => {
                  const def = getDefaultQuad(dimensions.width, dimensions.height);
                  setLocalPerspectiveQuad(def);
                  if (onPerspectiveQuadChange) onPerspectiveQuadChange(def);
                }}
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                title="Restablecer cuadrilátero estándar"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer</span>
              </button>
            </div>
          )}

          {/* Subcontroles de Pluma Poligonal */}
          {toolMode === 'pen' && (
            <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-amber-500/30">
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => setPenMode('add')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    penMode === 'add' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Sumar Pared</span>
                </button>
                <button
                  onClick={() => setPenMode('subtract')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    penMode === 'subtract' ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Minus className="w-3 h-3" />
                  <span>- Restar Ventana / Mueble</span>
                </button>
              </div>

              <span className="font-mono text-xs text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {polyPoints.length} {polyPoints.length === 1 ? 'punto' : 'puntos'}
              </span>

              {polyPoints.length >= 3 && (
                <button
                  onClick={() => completePolygon()}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg cursor-pointer transition-all shadow-md animate-pulse"
                  title="Cerrar y rellenar el polígono trazado (o presiona Enter)"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Cerrar y Rellenar</span>
                </button>
              )}

              {polyPoints.length > 0 && (
                <>
                  <button
                    onClick={() => setPolyPoints((prev) => prev.slice(0, -1))}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                    title="Deshacer el último punto colocado"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Deshacer</span>
                  </button>
                  <button
                    onClick={() => {
                      setPolyPoints([]);
                      setIsHoveringFirstPoint(false);
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 rounded-lg cursor-pointer"
                    title="Cancelar trazo actual"
                  >
                    <X className="w-3 h-3" />
                    <span>Cancelar</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Subcontroles de Varita Mágica */}
          {toolMode === 'magic_wand' && (
            <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-amber-500/30">
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => setWandMode('add')}
                  className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    wandMode === 'add' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  + Sumar
                </button>
                <button
                  onClick={() => setWandMode('subtract')}
                  className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    wandMode === 'subtract' ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  - Restar
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Tolerancia:</span>
                <input
                  type="range"
                  min="5"
                  max="45"
                  value={wandTolerance}
                  onChange={(e) => setWandTolerance(parseInt(e.target.value))}
                  className="w-16 sm:w-20 accent-amber-500 cursor-pointer"
                />
                <span className="font-mono text-amber-400">{wandTolerance}</span>
              </div>

              {isWandProcessing && (
                <span className="text-amber-400 font-medium animate-pulse flex items-center gap-1">
                  <Sparkles className="w-3 h-3 animate-spin" />
                  <span>Procesando...</span>
                </span>
              )}
            </div>
          )}

          {/* Control de Grosor del Pincel / Borrador */}
          {(toolMode === 'brush' || toolMode === 'eraser') && (
            <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-medium">Tamaño:</span>
              <input
                type="range"
                min="5"
                max="100"
                value={brushSliderValue}
                onChange={(e) => setBrushSliderValue(parseInt(e.target.value))}
                className="w-20 sm:w-28 accent-amber-500 cursor-pointer"
              />
              <span className="font-mono text-amber-400 min-w-8 text-center">{brushSliderValue}%</span>
            </div>
          )}

          {/* Indicador de Restar Objeto */}
          {toolMode === 'smart_erase' && (
            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-xl text-rose-300">
              <Target className={`w-3.5 h-3.5 ${isSmartErasing ? 'animate-spin' : ''}`} />
              <span>{isSmartErasing ? 'Aislando objeto...' : 'Haz clic sobre un mueble u objeto para recortarlo'}</span>
            </div>
          )}

          {/* Botón Mágico: Restar Muebles (IA) */}
          <button
            onClick={handleAutoSubtractFurniture}
            disabled={isSubtractingFurniture}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
            title="La IA detecta automáticamente los sofás, lámparas, cuadros y plantas que estén frente a la pared y los resta con precisión"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isSubtractingFurniture ? 'animate-spin' : ''}`} />
            <span>{isSubtractingFurniture ? 'Detectando muebles...' : '🪄 Restar Muebles (IA)'}</span>
          </button>
        </div>

        {/* Acciones de Vista, Limpieza y Guardado */}
        <div className="flex items-center gap-2">
          {transformedUrl && (
            <button
              onClick={() => setBgMode(bgMode === 'original' ? 'transformed' : 'original')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold cursor-pointer"
              title="Alternar entre ver foto original o foto con panel aplicado"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>{bgMode === 'original' ? 'Ver con Panel' : 'Ver Foto Original'}</span>
            </button>
          )}

          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Limpiar máscara para comenzar desde cero"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Limpiar</span>
          </button>

          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black rounded-xl shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95 text-xs tracking-wide uppercase"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Aplicar Cambios</span>
          </button>
        </div>
      </div>

      {/* Banner de inicio limpio si la foto no tiene selección aún */}
      {!hasDrawnMask && polyPoints.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 rounded-xl text-xs text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PenTool className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Foto lista sin selección previa:</strong> Haz clic en la foto con la <strong>Pluma Poligonal</strong> en las 4 esquinas de tu pared (techo y piso) para trazar el área y calibrar la perspectiva 3D automáticamente.
            </span>
          </div>
          <span className="text-[11px] text-slate-400 shrink-0 hidden sm:inline">
            Doble clic o clic en el 1er punto para cerrar
          </span>
        </div>
      )}

      {/* Contenedor interactivo con márgenes laterales seguros para scroll en celular */}
      <div className="flex items-center justify-center w-full bg-slate-950/40 px-3 sm:px-6 py-2.5 rounded-2xl relative">
        {/* Indicadores sutiles de scroll en los márgenes laterales para celular */}
        <div className="flex sm:hidden absolute left-1 top-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-[9px] text-slate-500/80 pointer-events-none select-none font-semibold">
          <span>▲</span>
          <span className="[writing-mode:vertical-lr] tracking-widest uppercase">Scroll</span>
          <span>▼</span>
        </div>
        <div className="flex sm:hidden absolute right-1 top-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-[9px] text-slate-500/80 pointer-events-none select-none font-semibold">
          <span>▲</span>
          <span className="[writing-mode:vertical-lr] tracking-widest uppercase">Scroll</span>
          <span>▼</span>
        </div>

        <div
          ref={containerRef}
          style={{
            aspectRatio: `${dimensions.width} / ${dimensions.height}`,
            maxHeight: isVertical ? 'min(72vh, 680px)' : 'min(62vh, 580px)',
            maxWidth: `min(86%, calc(${isVertical ? 'min(72vh, 680px)' : 'min(62vh, 580px)'} * ${dimensions.width} / ${dimensions.height}))`,
            width: '86%',
            margin: '0 auto'
          }}
          className="relative bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-700/80 shadow-2xl select-none touch-none shrink-0 sm:w-full sm:max-w-full"
        >
          {/* Foto de fondo con relación de aspecto nativa exacta */}
          <img
            src={activeBackgroundUrl}
            alt="Fondo de trabajo"
            className="absolute inset-0 w-full h-full block pointer-events-none select-none object-contain"
          />

          {/* Canvas de Máscara (1:1 en resolución con la imagen original) */}
          <canvas
            ref={maskCanvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onDoubleClick={handleDoubleClick}
            className="absolute inset-0 w-full h-full block cursor-none touch-none z-10"
          />

          {/* Overlay SVG interactivo sincronizado con viewBox */}
          <svg
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none z-20"
          >
            {/* Trazado activo de la Pluma Poligonal */}
            {polyPoints.length > 0 && (
              <g>
                <polyline
                  points={polyPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={penMode === 'subtract' ? '#ef4444' : '#f59e0b'}
                  strokeWidth="3.5"
                  strokeDasharray="6 3"
                />

                {cursorCoords && (
                  <line
                    x1={polyPoints[polyPoints.length - 1].x}
                    y1={polyPoints[polyPoints.length - 1].y}
                    x2={cursorCoords.x}
                    y2={cursorCoords.y}
                    stroke={penMode === 'subtract' ? '#ef4444' : '#f59e0b'}
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                  />
                )}

                {polyPoints.map((pt, idx) => {
                  const isFirst = idx === 0;
                  const isBeingDragged = activePolyIndex === idx;
                  const visualRadius = isFirst
                    ? Math.max(22, Math.round(dimensions.width * 0.026))
                    : Math.max(18, Math.round(dimensions.width * 0.022));
                  const touchRadius = Math.max(42, Math.round(dimensions.width * 0.055));
                  const innerDotRadius = Math.max(6, Math.round(dimensions.width * 0.0075));
                  const badgeFontSize = Math.max(14, Math.round(dimensions.width * 0.017));

                  return (
                    <g key={idx} className="select-none" style={{ pointerEvents: 'auto' }}>
                      {/* Zona táctil invisible amplia para dedos en pantalla táctil */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={touchRadius}
                        fill="transparent"
                        className="cursor-move"
                      />

                      {/* Sombra de relieve */}
                      <circle
                        cx={pt.x}
                        cy={pt.y + 3}
                        r={visualRadius + 2}
                        fill="rgba(0,0,0,0.5)"
                      />

                      {/* Halo activo al tocar o arrastrar */}
                      {isBeingDragged && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={visualRadius * 1.55}
                          fill="rgba(245, 158, 11, 0.35)"
                          stroke="#f59e0b"
                          strokeWidth="3.5"
                          strokeDasharray="6 4"
                        />
                      )}

                      {/* Círculo visual principal de alta visibilidad */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={visualRadius}
                        fill={
                          isFirst
                            ? penMode === 'subtract' ? '#ef4444' : '#10b981'
                            : isBeingDragged ? '#f59e0b' : '#0f172a'
                        }
                        stroke={
                          isFirst
                            ? '#ffffff'
                            : isBeingDragged ? '#ffffff' : '#f59e0b'
                        }
                        strokeWidth={isBeingDragged ? '4' : '3'}
                        className="transition-transform duration-75"
                      />

                      {/* Punto central de precisión blanco */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={innerDotRadius}
                        fill="#ffffff"
                      />

                      {/* Número identificador del vértice (1, 2, 3...) */}
                      <text
                        x={pt.x}
                        y={pt.y - visualRadius - 8}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={badgeFontSize}
                        fontWeight="900"
                        className="select-none pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                      >
                        {idx + 1}
                      </text>

                      {/* Animación de pulso en el primer punto para cerrar el polígono */}
                      {isFirst && polyPoints.length >= 3 && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={visualRadius + 14}
                          fill="none"
                          stroke={penMode === 'subtract' ? '#ef4444' : '#10b981'}
                          strokeWidth="3"
                          className="animate-ping opacity-75"
                        />
                      )}
                    </g>
                  );
                })}

                {isHoveringFirstPoint && polyPoints.length >= 3 && (
                  <g>
                    <circle
                      cx={polyPoints[0].x}
                      cy={polyPoints[0].y}
                      r={Math.max(34, Math.round(dimensions.width * 0.038))}
                      fill="rgba(16, 185, 129, 0.35)"
                      stroke="#10b981"
                      strokeWidth="3.5"
                    />
                    <text
                      x={polyPoints[0].x + Math.max(26, Math.round(dimensions.width * 0.03))}
                      y={polyPoints[0].y - 10}
                      fill="#10b981"
                      fontSize={Math.max(16, Math.round(dimensions.width * 0.018))}
                      fontWeight="bold"
                      className="drop-shadow-md select-none"
                    >
                      ✓ Toca para cerrar área
                    </text>
                  </g>
                )}
              </g>
            )}

            {/* Visualización y Tiradores de Perspectiva 3D (4 Pines de Esquina) */}
            {toolMode === 'perspective' &&
              localPerspectiveQuad &&
              localPerspectiveQuad.length === 4 && (
                <g className="pointer-events-none">
                  {/* Líneas de fuga perimetrales */}
                  <polygon
                    points={localPerspectiveQuad.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                  />

                  {/* Diagonales de perspectiva (fuga interior) */}
                  <line
                    x1={localPerspectiveQuad[0].x}
                    y1={localPerspectiveQuad[0].y}
                    x2={localPerspectiveQuad[2].x}
                    y2={localPerspectiveQuad[2].y}
                    stroke="rgba(56, 189, 248, 0.25)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1={localPerspectiveQuad[1].x}
                    y1={localPerspectiveQuad[1].y}
                    x2={localPerspectiveQuad[3].x}
                    y2={localPerspectiveQuad[3].y}
                    stroke="rgba(56, 189, 248, 0.25)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />

                  {/* Pines interactivos de esquina */}
                  {localPerspectiveQuad.map((pin, i) => (
                    <g key={i}>
                      {/* Círculo exterior brillante con halo */}
                      <circle
                        cx={pin.x}
                        cy={pin.y}
                        r="14"
                        fill="rgba(14, 165, 233, 0.45)"
                        stroke="#0284c7"
                        strokeWidth="2.5"
                        className={activePinIndex === i ? 'scale-125 transition-transform' : ''}
                      />
                      {/* Punto interior blanco */}
                      <circle cx={pin.x} cy={pin.y} r="5" fill="#ffffff" />

                      {/* Etiqueta de la esquina */}
                      <rect
                        x={i % 2 === 0 ? pin.x + 16 : pin.x - 90}
                        y={pin.y - 12}
                        width="76"
                        height="20"
                        rx="4"
                        fill="rgba(15, 23, 42, 0.85)"
                        stroke="#0284c7"
                        strokeWidth="1"
                      />
                      <text
                        x={i % 2 === 0 ? pin.x + 22 : pin.x - 84}
                        y={pin.y + 2}
                        fill="#38bdf8"
                        fontSize="11"
                        fontWeight="bold"
                        className="select-none"
                      >
                        {pinLabels[i]?.title}
                      </text>
                    </g>
                  ))}
                </g>
              )}

            {/* Recuadro si se usa herramienta recuadro */}
            {currentBox && currentBox.width > 0 && currentBox.height > 0 && (
              <rect
                x={currentBox.x}
                y={currentBox.y}
                width={currentBox.width}
                height={currentBox.height}
                className="fill-amber-500/30 stroke-amber-400 stroke-[4] stroke-dasharray-[8,6] animate-pulse"
              />
            )}

            {/* Cursor para Pluma Poligonal */}
            {cursorCoords && toolMode === 'pen' && !isHoveringFirstPoint && (
              <g>
                <circle
                  cx={cursorCoords.x}
                  cy={cursorCoords.y}
                  r="6"
                  fill={penMode === 'subtract' ? '#ef4444' : '#f59e0b'}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <line
                  x1={cursorCoords.x - 14}
                  y1={cursorCoords.y}
                  x2={cursorCoords.x + 14}
                  y2={cursorCoords.y}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <line
                  x1={cursorCoords.x}
                  y1={cursorCoords.y - 14}
                  x2={cursorCoords.x}
                  y2={cursorCoords.y + 14}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </g>
            )}

            {/* Cursor para Pines de Perspectiva */}
            {cursorCoords && toolMode === 'perspective' && (
              <g>
                <circle cx={cursorCoords.x} cy={cursorCoords.y} r="10" fill="rgba(56, 189, 248, 0.3)" stroke="#38bdf8" strokeWidth="2" />
                <circle cx={cursorCoords.x} cy={cursorCoords.y} r="3" fill="#ffffff" />
              </g>
            )}

            {/* Cursor circular para Pincel y Borrador */}
            {cursorCoords && (toolMode === 'brush' || toolMode === 'eraser') && (
              <g>
                <circle
                  cx={cursorCoords.x}
                  cy={cursorCoords.y}
                  r={brushRadius}
                  fill={toolMode === 'eraser' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.3)'}
                  stroke={toolMode === 'eraser' ? '#ef4444' : '#f59e0b'}
                  strokeWidth={Math.max(1.5, brushRadius * 0.08)}
                />
                <line
                  x1={cursorCoords.x - brushRadius * 0.35}
                  y1={cursorCoords.y}
                  x2={cursorCoords.x + brushRadius * 0.35}
                  y2={cursorCoords.y}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <line
                  x1={cursorCoords.x}
                  y1={cursorCoords.y - brushRadius * 0.35}
                  x2={cursorCoords.x}
                  y2={cursorCoords.y + brushRadius * 0.35}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* Cursor especial para Restar Objeto (GrabCut) */}
            {cursorCoords && toolMode === 'smart_erase' && (
              <g>
                <circle
                  cx={cursorCoords.x}
                  cy={cursorCoords.y}
                  r="18"
                  fill="rgba(244, 63, 94, 0.25)"
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                />
                <circle cx={cursorCoords.x} cy={cursorCoords.y} r="6" fill="#f43f5e" stroke="#ffffff" strokeWidth="1.5" />
                <line x1={cursorCoords.x - 26} y1={cursorCoords.y} x2={cursorCoords.x + 26} y2={cursorCoords.y} stroke="#f43f5e" strokeWidth="2" />
                <line x1={cursorCoords.x} y1={cursorCoords.y - 26} x2={cursorCoords.x} y2={cursorCoords.y + 26} stroke="#f43f5e" strokeWidth="2" />
              </g>
            )}

            {/* Cursor especial para la Varita Mágica */}
            {cursorCoords && toolMode === 'magic_wand' && (
              <g>
                <circle
                  cx={cursorCoords.x}
                  cy={cursorCoords.y}
                  r="14"
                  fill={wandMode === 'subtract' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.3)'}
                  stroke={wandMode === 'subtract' ? '#ef4444' : '#f59e0b'}
                  strokeWidth="2"
                />
                <line x1={cursorCoords.x - 22} y1={cursorCoords.y} x2={cursorCoords.x + 22} y2={cursorCoords.y} stroke="#ffffff" strokeWidth="2" />
                <line x1={cursorCoords.x} y1={cursorCoords.y - 22} x2={cursorCoords.x} y2={cursorCoords.y + 22} stroke="#ffffff" strokeWidth="2" />
              </g>
            )}
          </svg>

          {/* Indicador flotante en esquina */}
          <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-slate-950/85 backdrop-blur-md text-slate-300 text-xs font-medium border border-slate-700/60 flex items-center gap-2 pointer-events-none z-30">
            {toolMode === 'pen' && (
              <>
                <PenTool className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Pluma: <strong>Marca 4 esquinas</strong> para calibrar automáticamente la perspectiva 3D, o pulsa Enter para rellenar.
                </span>
              </>
            )}
            {toolMode === 'perspective' && (
              <>
                <Compass className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                <span>
                  Pines 3D: <strong>Arrastra cualquiera de los 4 pines azules</strong> para alinear la fuga del techo y piso.
                </span>
              </>
            )}
            {toolMode === 'smart_erase' && (
              <>
                <Target className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>Haz 1 clic sobre un cuadro, lámpara o cojín para <strong>recortarlo con IA</strong></span>
              </>
            )}
            {toolMode === 'magic_wand' && (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Varita Mágica: <strong>Haz 1 clic en la pared</strong> para rellenar respetando los filos</span>
              </>
            )}
            {toolMode === 'brush' && (
              <>
                <Paintbrush className="w-3.5 h-3.5 text-amber-400" />
                <span>Pinta para <strong>sumar</strong> pared (la cruz blanca marca el centro exacto)</span>
              </>
            )}
            {toolMode === 'eraser' && (
              <>
                <Eraser className="w-3.5 h-3.5 text-red-400" />
                <span>Pasa el borrador para <strong>restar</strong> cojines o muebles</span>
              </>
            )}
            {toolMode === 'box_select' && (
              <>
                <Crop className="w-3.5 h-3.5 text-amber-400" />
                <span>Arrastra un recuadro para seleccionar una zona rectangular</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Barra de estado inferior */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>Paredes detectadas por IA:</span>
          {walls.map((wall) => (
            <button
              key={wall.id}
              onClick={() => {
                onSelectWall(wall.id);
                loadWallIntoCanvas(wall.id);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold border transition-all cursor-pointer ${
                selectedWallId === wall.id && !currentMask
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {wall.name} ({wall.area_percentage}%)
            </button>
          ))}
        </div>
        <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 font-medium flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Al terminar tu trazo o ajuste, haz clic en <strong>"Aplicar Cambios"</strong></span>
        </span>
      </div>
    </div>
  );
}
