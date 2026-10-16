# 🪵 DecorWall AI — Visualizador Inteligente de Paneles Decorativos de Pared

Aplicativo web inteligente de alto impacto comercial diseñado para empresas de venta e instalación de **paneles decorativos de pared** (madera alistonada/acanalada, losas de mármol sinterizado, paneles 3D geométricos, microcemento y texturas arquitectónicas).

Permite a los clientes subir una foto real de su casa, sala, dormitorio u oficina, identificar de manera automática las paredes con Inteligencia Artificial, elegir qué pared decorar y previsualizar el cambio fotorrealista en vivo mediante un comparador interactivo **"Antes y Después"**, conservando las sombras reales, iluminación ambiental y los muebles u objetos que estén al frente (sofás, lámparas, plantas, cuadros).

---

## 🚀 Inicio Rápido (1 solo comando)

Abre tu terminal en la carpeta del proyecto y ejecuta:

```bash
cd /Users/xavieruraga/.gemini/antigravity/scratch/decorwall-ai
./start.sh
```

Abre tu navegador en: **`http://localhost:8000`**

---

## ✨ Características Principales

1. **Reconocimiento y Segmentación de Paredes con IA**:
   - Analiza la fotografía del cliente e identifica de inmediato las paredes de la habitación.
   - Si existen múltiples paredes (izquierda, fondo, derecha), el sistema las aísla de forma independiente para permitir seleccionar exactamente cuál intervenir.
   - Permite seleccionar paredes haciendo clic directo en el lienzo o pulsando sobre los botones de cada pared detectada.

2. **Preservación Realista de Iluminación y Sombras (Intrinsic Shading)**:
   - Extrae el mapa de iluminación ambiental y sombras arrojadas de la pared original.
   - Modula la textura del panel mediante multiplicación de luminancia normalizada, logrando que el panel adopte la luz de las ventanas, los reflejos de lámparas y las sombras de esquinas de forma natural.

3. **Oclusión de Objetos Frontales (Foreground Masking)**:
   - Detecta muebles (sofás, camas, mesas), plantas decorativas, lámparas de pie y accesorios situados delante de la pared.
   - El panel decorativo se proyecta **detrás** de los objetos, evitando el efecto falso de "pegatina" o "sticker".

4. **Comparador en Vivo "Antes y Después" (Split Slider)**:
   - Barra divisoria interactiva que se arrastra suavemente con el cursor o el dedo en pantallas táctiles (tablets o smartphones).
   - Botón *"Mantener para ver original"* para contrastar el cambio instantáneamente.
   - Descarga de la imagen transformada en alta resolución para enviar por WhatsApp o correo.

5. **Catálogo Dinámico de Paneles (Alimentable en caliente)**:
   - Carpeta local: `backend/catalog/`
   - El cliente puede arrastrar imágenes de nuevos modelos directamente en la carpeta o usar el botón **`+ Añadir`** en la barra lateral del aplicativo web.
   - Los nuevos diseños quedan disponibles de inmediato para previsualizar sin necesidad de reiniciar el servidor.

6. **Controles de Textura en Tiempo Real**:
   - **Escala del Panel**: Ajusta el ancho de los listones de madera o el tamaño de las losas de mármol (de 0.4x a 2.2x).
   - **Orientación**: Cambia entre orientación Vertical u Horizontal en un clic.
   - **Luz y Sombra**: Calibra la intensidad de las sombras según el tipo de panel.

---

## 📁 Estructura del Proyecto

```
decorwall-ai/
├── start.sh                      # Script para arrancar la aplicación completa
├── README.md                     # Documentación y guía de uso
├── backend/
│   ├── main.py                   # Servidor FastAPI y endpoints REST
│   ├── ai_engine.py              # Motor de segmentación y contornos de pared
│   ├── blending_engine.py        # Motor de fusión fotorrealista y shading map
│   ├── catalog_manager.py        # Gestor de archivos del catálogo
│   ├── catalog/                  # 📁 Carpeta de diseños de paneles (¡Agrégale tus fotos!)
│   │   ├── madera_alistonada_roble.jpg
│   │   ├── madera_alistonada_nogal.jpg
│   │   ├── marmol_calacatta_gold.jpg
│   │   ├── marmol_nero_marquina.jpg
│   │   ├── panel_3d_chevron_blanco.jpg
│   │   └── concreto_arquitectonico.jpg
│   ├── demo_rooms/               # Habitaciones de prueba para demostración instantánea
│   │   ├── sala_moderna.jpg
│   │   └── dormitorio_master.jpg
│   ├── uploads/                  # Fotos subidas por los usuarios
│   └── cache/                    # Renders procesados
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Header.jsx              # Barra superior y botón de descarga
    │   │   ├── BeforeAfterSlider.jsx   # Deslizador interactivo Antes/Después
    │   │   ├── WallSelectorCanvas.jsx  # Selector interactivo de paredes
    │   │   ├── CatalogSidebar.jsx      # Barra lateral del catálogo de paneles
    │   │   ├── TextureControls.jsx     # Controles de escala, rotación y luz
    │   │   └── UploadDropzone.jsx      # Zona de carga y habitaciones demo
    │   ├── App.jsx                     # Componente central
    │   └── index.css                   # Estilos Tailwind CSS
    └── dist/                           # Build de producción para FastAPI
```

---

## 🎨 Cómo Agregar Nuevos Paneles Decorativos

Tienes dos formas muy sencillas:

1. **Desde la Web**:
   - En la barra lateral derecha haz clic en el botón **`+ Añadir`**.
   - Selecciona la imagen del nuevo panel y se sumará de inmediato al catálogo.

2. **Copiando Archivos**:
   - Pega cualquier imagen (`.jpg`, `.png`, `.webp`) dentro de la carpeta:
     `decorwall-ai/backend/catalog/`
   - El sistema detectará automáticamente el nombre y la categoría según el nombre del archivo (ejemplo: `madera_roble_claro.jpg`, `marmol_verde_alpi.png`).
