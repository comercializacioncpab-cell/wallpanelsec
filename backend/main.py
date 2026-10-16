import os
import uuid
import base64
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List

import io
from PIL import Image, ImageOps

from ai_engine import wall_detector
from blending_engine import blending_engine
from catalog_manager import catalog_manager, CATALOG_DIR, DEMO_DIR

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads"))
CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "cache"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

app = FastAPI(title="DecorWall AI Backend", version="1.0.0")

# Habilitar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Almacenamiento en memoria para sesiones activas (imagen original, máscaras de pared, oclusiones)
SESSION_STORE = {}

class ApplyDecorRequest(BaseModel):
    image_id: str
    wall_id: Optional[str] = "wall_1"
    panel_id: str
    scale: float = 1.0
    rotation: int = 0
    shading_strength: float = 1.0
    point_x: Optional[int] = None
    point_y: Optional[int] = None
    custom_box: Optional[dict] = None
    custom_polygon: Optional[list] = None
    mask_base64: Optional[str] = None
    perspective_quad: Optional[list] = None

class EstimatePerspectiveRequest(BaseModel):
    image_id: str
    mask_base64: Optional[str] = None
    polygon: Optional[list] = None

class MagicWandRequest(BaseModel):
    image_id: str
    seed_x: int
    seed_y: int
    tolerance: int = 25
    mode: str = "add" # "add" | "subtract"
    mask_base64: Optional[str] = None

class AutoSubtractFurnitureRequest(BaseModel):
    image_id: str
    mask_base64: Optional[str] = None

class SmartObjectClickRequest(BaseModel):
    image_id: str
    seed_x: int
    seed_y: int
    mode: str = "subtract" # "subtract" | "add"
    mask_base64: Optional[str] = None

def decode_base64_mask(b64_str: str, target_w: int, target_h: int) -> Optional[np.ndarray]:
    if not b64_str:
        return None
    try:
        if "," in b64_str:
            b64_str = b64_str.split(",")[1]
        raw_bytes = base64.b64decode(b64_str)
        nparr = np.frombuffer(raw_bytes, np.uint8)
        decoded = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
        if decoded is None:
            return None
        
        if len(decoded.shape) == 3 and decoded.shape[2] == 4:
            alpha = decoded[:, :, 3]
            rgb_max = np.max(decoded[:, :, :3], axis=2)
            if np.all(alpha == 255):
                wall_mask = (rgb_max > 30).astype(np.uint8) * 255
            elif np.max(rgb_max) == 0:
                wall_mask = (alpha > 30).astype(np.uint8) * 255
            else:
                wall_mask = ((alpha > 30) & (rgb_max > 30)).astype(np.uint8) * 255
        elif len(decoded.shape) == 3:
            wall_mask = (cv2.cvtColor(decoded, cv2.COLOR_BGR2GRAY) > 30).astype(np.uint8) * 255
        else:
            wall_mask = (decoded > 30).astype(np.uint8) * 255

        if wall_mask.shape[:2] != (target_h, target_w):
            wall_mask = cv2.resize(wall_mask, (target_w, target_h), interpolation=cv2.INTER_NEAREST)

        return (wall_mask > 80).astype(np.uint8) * 255
    except Exception as e:
        print("[DecorWall AI] Error decodificando mask_base64:", e)
        return None

def encode_mask_to_rgba_png_base64(binary_mask: np.ndarray) -> str:
    h, w = binary_mask.shape[:2]
    mask_rgba = np.zeros((h, w, 4), dtype=np.uint8)
    mask_rgba[binary_mask > 80] = [11, 158, 245, 180] # ámbar nítido rígido
    _, png_buf = cv2.imencode(".png", mask_rgba)
    return "data:image/png;base64," + base64.b64encode(png_buf).decode("utf-8")



@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "DecorWall AI API"}

@app.get("/api/catalog")
def get_catalog():
    panels = catalog_manager.list_catalog_panels()
    return {"panels": panels}

@app.get("/api/catalog/image/{filename}")
def get_catalog_image(filename: str):
    file_path = os.path.join(CATALOG_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Diseño no encontrado")
    return FileResponse(file_path)

@app.post("/api/catalog/upload")
async def upload_catalog_panel(file: UploadFile = File(...)):
    content = await file.read()
    new_panel = catalog_manager.save_new_panel(content, file.filename)
    return {"message": "Diseño agregado con éxito al catálogo", "panel": new_panel}

@app.get("/api/demo-rooms")
def get_demo_rooms():
    demos = catalog_manager.list_demo_rooms()
    return {"demos": demos}

@app.get("/api/demo-room/{filename}")
def get_demo_room_image(filename: str):
    file_path = os.path.join(DEMO_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Habitación demo no encontrada")
    return FileResponse(file_path)

@app.get("/api/images/{filename}")
def get_processed_image(filename: str):
    file_path = os.path.join(CACHE_DIR, filename)
    if not os.path.exists(file_path):
        file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    return FileResponse(file_path)

def process_and_store_image(image_bgr: np.ndarray, ext=".jpg") -> dict:
    image_id = str(uuid.uuid4())
    filename = f"{image_id}{ext}"
    saved_path = os.path.join(UPLOAD_DIR, filename)
    cv2.imwrite(saved_path, image_bgr)

    # Ejecutar detección por IA de paredes y objetos en primer plano
    detection_res = wall_detector.detect_walls_and_foreground(image_bgr)
    
    # Preparar resumen de paredes para el cliente
    walls_info = []
    wall_masks = {}
    
    for w in detection_res["walls"]:
        walls_info.append({
            "id": w["id"],
            "name": w["name"],
            "area_percentage": w["area_percentage"],
            "centroid": w["centroid"],
            "bounding_box": w["bounding_box"],
            "polygon": w["polygon"]
        })
        wall_masks[w["id"]] = w["mask"]

    # Guardar en memoria de sesión
    SESSION_STORE[image_id] = {
        "image_bgr": image_bgr,
        "filename": filename,
        "walls_info": walls_info,
        "wall_masks": wall_masks,
        "foreground_mask": detection_res["foreground_mask"]
    }

    h, w = image_bgr.shape[:2]
    orientation = "vertical" if h > w else "horizontal"
    aspect_ratio = round(w / float(h), 4)

    return {
        "image_id": image_id,
        "dimensions": {"width": w, "height": h},
        "orientation": orientation,
        "aspect_ratio": aspect_ratio,
        "walls": walls_info,
        "original_url": f"/api/images/{filename}",
        "is_demo": False
    }

@app.post("/api/upload-room")
async def upload_room_image(file: UploadFile = File(...)):
    content = await file.read()
    image_bgr = None
    try:
        # Usar PIL con ImageOps.exif_transpose para respetar al 100% la orientación de celulares
        pil_img = Image.open(io.BytesIO(content))
        pil_img = ImageOps.exif_transpose(pil_img)
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")
        image_rgb = np.array(pil_img)
        image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
    except Exception as e:
        print("[DecorWall AI] Error con PIL exif_transpose, usando fallback cv2:", e)
        nparr = np.frombuffer(content, np.uint8)
        image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Formato de imagen inválido")

    # Si la imagen es gigantesca (> 2000px), redimensionarla proporcionalmente para agilidad
    max_dim = 1600
    h, w = image_bgr.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        image_bgr = cv2.resize(image_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    return process_and_store_image(image_bgr)

@app.post("/api/load-demo-room/{demo_id}")
def load_demo_room(demo_id: str):
    demo_path = os.path.join(DEMO_DIR, demo_id)
    if not os.path.exists(demo_path):
        raise HTTPException(status_code=404, detail="Habitación demo no encontrada")
    
    try:
        pil_img = Image.open(demo_path)
        pil_img = ImageOps.exif_transpose(pil_img)
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")
        image_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    except Exception:
        image_bgr = cv2.imread(demo_path)

    res = process_and_store_image(image_bgr)
    res["is_demo"] = True

    # Inyectar máscara de pared real pre-detectada si existe para este demo
    base_name = os.path.splitext(demo_id)[0]
    mask_path = os.path.join(DEMO_DIR, f"{base_name}_mask.png")
    if os.path.exists(mask_path):
        precomputed = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        if precomputed is not None:
            h, w = image_bgr.shape[:2]
            if precomputed.shape[:2] != (h, w):
                precomputed = cv2.resize(precomputed, (w, h), interpolation=cv2.INTER_NEAREST)
            
            image_id = res["image_id"]
            SESSION_STORE[image_id]["active_mask"] = precomputed
            SESSION_STORE[image_id]["wall_masks"]["wall_1"] = precomputed
            SESSION_STORE[image_id]["is_custom_mask"] = True
            SESSION_STORE[image_id]["foreground_mask"] = None
            
            # Generar versión base64 PNG para el canvas de la interfaz
            mask_rgba = np.zeros((h, w, 4), dtype=np.uint8)
            mask_rgba[precomputed > 80] = [11, 158, 245, 180] # ámbar nítido rígido
            _, png_buf = cv2.imencode(".png", mask_rgba)
            res["initial_mask"] = "data:image/png;base64," + base64.b64encode(png_buf).decode("utf-8")

    return res

@app.post("/api/rotate-room/{image_id}")
def rotate_room(image_id: str):
    session = SESSION_STORE.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    # Rotar 90 grados en sentido horario
    rotated_bgr = cv2.rotate(session["image_bgr"], cv2.ROTATE_90_CLOCKWISE)
    return process_and_store_image(rotated_bgr)

@app.post("/api/magic-wand")
def magic_wand_selection(req: MagicWandRequest):
    session = SESSION_STORE.get(req.image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    room_bgr = session["image_bgr"]
    h, w = room_bgr.shape[:2]
    
    sx = max(0, min(w - 1, int(req.seed_x)))
    sy = max(0, min(h - 1, int(req.seed_y)))
    
    # Obtener máscara base actual
    current_mask = None
    if req.mask_base64:
        current_mask = decode_base64_mask(req.mask_base64, w, h)
    if current_mask is None:
        current_mask = session.get("active_mask")
    if current_mask is None or current_mask.shape[:2] != (h, w):
        current_mask = np.zeros((h, w), dtype=np.uint8)

    # Detección de bordes fuertes con cierre morfológico para evitar fugas de 1 píxel
    gray = cv2.cvtColor(room_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 30, 90)
    edges_closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
    edges_dilated = cv2.dilate(edges_closed, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    
    ff_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
    ff_mask[1:-1, 1:-1] = (edges_dilated > 0).astype(np.uint8) * 255
    
    tol = max(5, min(50, int(req.tolerance)))
    diff = (tol, tol, tol)
    
    # FLOODFILL_FIXED_RANGE: Compara contra el color de la semilla, impidiendo que fluya a través de gradientes
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8)
    
    _, _, mask_out, _ = cv2.floodFill(
        room_bgr.copy(), ff_mask, (sx, sy), (255, 255, 255),
        loDiff=diff, upDiff=diff,
        flags=flags
    )
    
    wand_selected = (mask_out[1:-1, 1:-1] == 255).astype(np.uint8) * 255
    
    if req.mode == "subtract":
        new_active = cv2.bitwise_and(current_mask, cv2.bitwise_not(wand_selected))
    else:
        new_active = cv2.bitwise_or(current_mask, wand_selected)
        
    session["active_mask"] = new_active
    session["is_custom_mask"] = True
    
    return {
        "status": "success",
        "mask_base64": encode_mask_to_rgba_png_base64(new_active),
        "selected_pixels": int(np.count_nonzero(new_active))
    }

@app.post("/api/auto-subtract-furniture")
def auto_subtract_furniture(req: AutoSubtractFurnitureRequest):
    session = SESSION_STORE.get(req.image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    room_bgr = session["image_bgr"]
    h, w = room_bgr.shape[:2]
    
    current_mask = None
    if req.mask_base64:
        current_mask = decode_base64_mask(req.mask_base64, w, h)
    if current_mask is None:
        current_mask = session.get("active_mask")
    if current_mask is None or np.count_nonzero(current_mask) == 0:
        raise HTTPException(status_code=400, detail="No hay una selección activa sobre la cual restar muebles")
        
    lab = cv2.cvtColor(room_bgr, cv2.COLOR_BGR2LAB)
    gray = cv2.cvtColor(room_bgr, cv2.COLOR_BGR2GRAY)
    
    # Muestra de la pared: tomar píxeles en el tercio superior de la selección activa
    masked_coords = np.where(current_mask > 80)
    min_y = np.min(masked_coords[0])
    max_y = np.max(masked_coords[0])
    wall_sample_y_limit = min_y + int((max_y - min_y) * 0.35)
    
    sample_mask = (current_mask > 80) & (np.arange(h)[:, None] <= wall_sample_y_limit)
    if np.count_nonzero(sample_mask) > 100:
        wall_sample = lab[sample_mask]
        median_color = np.median(wall_sample, axis=0)
    else:
        median_color = np.median(lab[current_mask > 80], axis=0)
        
    color_dist = np.linalg.norm(lab.astype(np.float32) - median_color, axis=2)
    lap = np.abs(cv2.Laplacian(gray, cv2.CV_32F))
    lap_smooth = cv2.GaussianBlur(lap, (15, 15), 0)
    
    edges = cv2.Canny(gray, 25, 80)
    edges_closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
    edges_dilated = cv2.dilate(edges_closed, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    
    lower_region = np.zeros((h, w), dtype=bool)
    lower_region[int(h * 0.25):, :] = True
    
    is_furniture = ((color_dist > 22) | (lap_smooth > 4.0) | (edges_dilated > 0)) & (current_mask > 80) & lower_region
    is_furniture_u8 = is_furniture.astype(np.uint8) * 255
    is_furniture_u8 = cv2.morphologyEx(is_furniture_u8, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15)))
    
    new_mask = cv2.bitwise_and(current_mask, cv2.bitwise_not(is_furniture_u8))
    new_mask = (new_mask > 80).astype(np.uint8) * 255
    
    session["active_mask"] = new_mask
    session["is_custom_mask"] = True
    
    return {
        "status": "success",
        "mask_base64": encode_mask_to_rgba_png_base64(new_mask),
        "subtracted_pixels": int(np.count_nonzero(is_furniture_u8)),
        "remaining_pixels": int(np.count_nonzero(new_mask))
    }

@app.post("/api/smart-object-erase")
def smart_object_erase(req: SmartObjectClickRequest):
    session = SESSION_STORE.get(req.image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    room_bgr = session["image_bgr"]
    h, w = room_bgr.shape[:2]
    
    current_mask = None
    if req.mask_base64:
        current_mask = decode_base64_mask(req.mask_base64, w, h)
    if current_mask is None:
        current_mask = session.get("active_mask")
    if current_mask is None or current_mask.shape[:2] != (h, w):
        current_mask = np.zeros((h, w), dtype=np.uint8)
        
    sx = max(0, min(w - 1, int(req.seed_x)))
    sy = max(0, min(h - 1, int(req.seed_y)))
    
    box_size = max(120, int(min(w, h) * 0.35))
    x1 = max(0, sx - box_size // 2)
    y1 = max(0, sy - box_size // 2)
    x2 = min(w, sx + box_size // 2)
    y2 = min(h, sy + box_size // 2)
    
    crop = room_bgr[y1:y2, x1:x2].copy()
    ch, cw = crop.shape[:2]
    
    gc_mask = np.full((ch, cw), cv2.GC_PR_BGD, dtype=np.uint8)
    gc_mask[0, :] = cv2.GC_BGD
    gc_mask[-1, :] = cv2.GC_BGD
    gc_mask[:, 0] = cv2.GC_BGD
    gc_mask[:, -1] = cv2.GC_BGD
    
    cx_in_crop, cy_in_crop = sx - x1, sy - y1
    seed_radius = max(6, int(box_size * 0.06))
    cv2.circle(gc_mask, (cx_in_crop, cy_in_crop), seed_radius, cv2.GC_FGD, -1)
    
    try:
        bgdModel = np.zeros((1, 65), np.float64)
        fgdModel = np.zeros((1, 65), np.float64)
        cv2.grabCut(crop, gc_mask, None, bgdModel, fgdModel, 3, cv2.GC_INIT_WITH_MASK)
        crop_obj = np.where((gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
        crop_obj = cv2.morphologyEx(crop_obj, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    except Exception as e:
        print("[DecorWall AI] Grabcut fallback:", e)
        crop_obj = np.zeros((ch, cw), dtype=np.uint8)
        cv2.circle(crop_obj, (cx_in_crop, cy_in_crop), seed_radius * 2, 255, -1)
        
    obj_mask = np.zeros((h, w), dtype=np.uint8)
    obj_mask[y1:y2, x1:x2] = crop_obj
    
    if req.mode == "subtract":
        new_active = cv2.bitwise_and(current_mask, cv2.bitwise_not(obj_mask))
    else:
        new_active = cv2.bitwise_or(current_mask, obj_mask)
        
    session["active_mask"] = new_active
    session["is_custom_mask"] = True
    
    return {
        "status": "success",
        "mask_base64": encode_mask_to_rgba_png_base64(new_active),
        "object_pixels": int(np.count_nonzero(obj_mask))
    }

@app.post("/api/estimate-perspective")
def estimate_perspective(req: EstimatePerspectiveRequest):
    session = SESSION_STORE.get(req.image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    h, w = session["image_bgr"].shape[:2]
    
    pts = None
    if req.polygon and len(req.polygon) >= 4:
        if len(req.polygon) == 4:
            raw_pts = np.float32([[float(p["x"]), float(p["y"])] for p in req.polygon])
            s = raw_pts.sum(axis=1)
            diff = raw_pts[:, 0] - raw_pts[:, 1]
            tl = raw_pts[np.argmin(s)]
            br = raw_pts[np.argmax(s)]
            tr = raw_pts[np.argmax(diff)]
            bl = raw_pts[np.argmin(diff)]
            return {
                "quad": [
                    {"x": round(float(tl[0]), 1), "y": round(float(tl[1]), 1)},
                    {"x": round(float(tr[0]), 1), "y": round(float(tr[1]), 1)},
                    {"x": round(float(br[0]), 1), "y": round(float(br[1]), 1)},
                    {"x": round(float(bl[0]), 1), "y": round(float(bl[1]), 1)},
                ]
            }
        else:
            pts = np.float32([[float(p["x"]), float(p["y"])] for p in req.polygon])
            
    if pts is None:
        current_mask = None
        if req.mask_base64:
            current_mask = decode_base64_mask(req.mask_base64, w, h)
        if current_mask is None:
            current_mask = session.get("active_mask")
        
        if current_mask is not None and np.count_nonzero(current_mask > 80) > 100:
            contours, _ = cv2.findContours(current_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                main_cnt = max(contours, key=cv2.contourArea)
                pts = main_cnt.reshape(-1, 2).astype(np.float32)

    if pts is None or len(pts) < 4:
        return {
            "quad": [
                {"x": round(w * 0.1, 1), "y": round(h * 0.15, 1)},
                {"x": round(w * 0.9, 1), "y": round(h * 0.15, 1)},
                {"x": round(w * 0.9, 1), "y": round(h * 0.85, 1)},
                {"x": round(w * 0.1, 1), "y": round(h * 0.85, 1)},
            ]
        }

    # Extraer las 4 esquinas extremales ordenadas [TL, TR, BR, BL]
    s = pts.sum(axis=1)
    diff = pts[:, 0] - pts[:, 1]
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmax(diff)]
    bl = pts[np.argmin(diff)]

    return {
        "quad": [
            {"x": round(float(tl[0]), 1), "y": round(float(tl[1]), 1)},
            {"x": round(float(tr[0]), 1), "y": round(float(tr[1]), 1)},
            {"x": round(float(br[0]), 1), "y": round(float(br[1]), 1)},
            {"x": round(float(bl[0]), 1), "y": round(float(bl[1]), 1)},
        ]
    }

@app.post("/api/apply-decor")
def apply_decor(req: ApplyDecorRequest):
    session = SESSION_STORE.get(req.image_id)
    
    # Auto-rehidratación si la sesión se perdió por reinicio del contenedor/servidor
    if not session:
        matched_file = None
        for folder in [UPLOAD_DIR, DEMO_DIR]:
            if not os.path.exists(folder):
                continue
            for fname in os.listdir(folder):
                if fname == req.image_id or fname.startswith(f"{req.image_id}."):
                    matched_file = os.path.join(folder, fname)
                    break
            if matched_file:
                break

        if matched_file and os.path.exists(matched_file):
            try:
                img_bgr = cv2.imread(matched_file)
                if img_bgr is not None:
                    detection_res = wall_detector.detect_walls_and_foreground(img_bgr)
                    wall_masks = {w["id"]: w["mask"] for w in detection_res["walls"]}
                    session = {
                        "image_bgr": img_bgr,
                        "filename": os.path.basename(matched_file),
                        "walls_info": detection_res["walls"],
                        "wall_masks": wall_masks,
                        "foreground_mask": detection_res["foreground_mask"]
                    }
                    SESSION_STORE[req.image_id] = session
            except Exception as e:
                print(f"[DecorWall AI] Error rehidratando sesión desde {matched_file}: {e}")

    if not session:
        raise HTTPException(
            status_code=404,
            detail="La sesión de tu imagen expiró debido al reinicio del servidor. Por favor selecciona una habitación de muestra o sube tu foto de nuevo."
        )

    room_bgr = session["image_bgr"]
    h, w = room_bgr.shape[:2]

    # Cargar panel decorativo con fallback resiliente al primer panel disponible
    panel_path = os.path.join(CATALOG_DIR, req.panel_id) if req.panel_id else None
    if not panel_path or not os.path.exists(panel_path):
        available_panels = [f for f in sorted(os.listdir(CATALOG_DIR)) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
        if available_panels:
            panel_path = os.path.join(CATALOG_DIR, available_panels[0])
        else:
            raise HTTPException(status_code=404, detail="No se encontraron texturas de paneles en el catálogo")

    panel_bgr = cv2.imread(panel_path)
    if panel_bgr is None:
        raise HTTPException(status_code=500, detail="Error leyendo archivo de textura de panel")

    # Determinar la máscara de pared / zona a intervenir
    wall_mask = None
    if req.mask_base64:
        wall_mask = decode_base64_mask(req.mask_base64, w, h)
        if wall_mask is not None and np.count_nonzero(wall_mask > 20) > 0:
            active_px = int(np.count_nonzero(wall_mask))
            print(f"[DecorWall AI] mask_base64 procesada con éxito: {active_px} píxeles marcados ({round(active_px/(h*w)*100, 2)}% del área)")
            session["active_mask"] = wall_mask
            session["is_custom_mask"] = True
        else:
            wall_mask = None

    if wall_mask is None and req.custom_box:
        # Modo selección de zona rectangular definida por el usuario
        bx = max(0, min(w - 1, int(req.custom_box.get("x", 0))))
        by = max(0, min(h - 1, int(req.custom_box.get("y", 0))))
        bw = max(10, min(w - bx, int(req.custom_box.get("width", w))))
        bh = max(10, min(h - by, int(req.custom_box.get("height", h))))
        
        wall_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.rectangle(wall_mask, (bx, by), (bx + bw, by + bh), 255, -1)
        session["active_mask"] = wall_mask
        session["is_custom_mask"] = True
    elif wall_mask is None and req.custom_polygon and len(req.custom_polygon) >= 3:
        # Modo selección por polígono libre
        wall_mask = np.zeros((h, w), dtype=np.uint8)
        pts = np.array([[int(p["x"]), int(p["y"])] for p in req.custom_polygon], dtype=np.int32)
        cv2.fillPoly(wall_mask, [pts], 255)
        session["active_mask"] = wall_mask
        session["is_custom_mask"] = True
    elif wall_mask is None and req.point_x is not None and req.point_y is not None:
        # Modo selección por clic en punto asistido por IA
        wall_mask = wall_detector.segment_at_point(room_bgr, req.point_x, req.point_y)
        session["active_mask"] = wall_mask
        session["is_custom_mask"] = False
    elif wall_mask is None and session.get("active_mask") is not None:
        # Usar la última máscara activa guardada por el usuario (Pincel/Borrador/Pluma)
        wall_mask = session["active_mask"]
    elif wall_mask is None and req.wall_id and session.get("wall_masks") and req.wall_id in session["wall_masks"]:
        wall_mask = session["wall_masks"][req.wall_id]
        session["active_mask"] = wall_mask
        session["is_custom_mask"] = False
    elif wall_mask is None and session.get("wall_masks") and len(session["wall_masks"]) > 0:
        first_wall_id = next(iter(session["wall_masks"]))
        wall_mask = session["wall_masks"][first_wall_id]
        session["active_mask"] = wall_mask
        session["is_custom_mask"] = False
    elif wall_mask is None:
        # Si no hay máscara ni pared previa, pero se enviaron los 4 puntos de perspectiva,
        # crear automáticamente la máscara a partir de esos 4 puntos
        if req.perspective_quad and len(req.perspective_quad) == 4:
            wall_mask = np.zeros((h, w), dtype=np.uint8)
            ordered_pts = blending_engine.order_quad_points(req.perspective_quad)
            cv2.fillPoly(wall_mask, [np.int32(ordered_pts)], 255)
            session["active_mask"] = wall_mask
            session["is_custom_mask"] = True
        else:
            raise HTTPException(
                status_code=400,
                detail="Por favor dibuja el área de la pared con la pluma (4 puntos) o selecciona una zona para aplicar el panel decorativo."
            )

    # Renderizar el panel decorativo con preservación de sombras e iluminación
    is_custom = session.get("is_custom_mask", False)
    fg_mask = None if is_custom else session.get("foreground_mask")

    try:
        transformed_bgr = blending_engine.apply_panel_to_wall(
            room_bgr=room_bgr,
            panel_bgr=panel_bgr,
            wall_mask=wall_mask,
            foreground_mask=fg_mask,
            scale=req.scale,
            rotation=req.rotation,
            shading_strength=req.shading_strength,
            perspective_quad=req.perspective_quad
        )
    except Exception as blend_err:
        print(f"[DecorWall AI] Error durante el blending 3D: {blend_err}. Usando fallback ortogonal directo.")
        transformed_bgr = blending_engine.apply_panel_to_wall(
            room_bgr=room_bgr,
            panel_bgr=panel_bgr,
            wall_mask=wall_mask,
            foreground_mask=None,
            scale=req.scale,
            rotation=req.rotation,
            shading_strength=req.shading_strength,
            perspective_quad=None
        )


    # Guardar en cache para descarga o visualización
    result_filename = f"result_{req.image_id}_{req.wall_id}_{uuid.uuid4().hex[:6]}.jpg"
    result_path = os.path.join(CACHE_DIR, result_filename)
    cv2.imwrite(result_path, transformed_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])

    # Convertir a base64 para inyección instantánea sin latencia de red
    _, buffer = cv2.imencode(".jpg", transformed_bgr, [cv2.IMWRITE_JPEG_QUALITY, 88])
    base64_img = base64.b64encode(buffer).decode("utf-8")

    return {
        "success": True,
        "status": "success",
        "result_url": f"/api/images/{result_filename}",
        "result_base64": f"data:image/jpeg;base64,{base64_img}",
        "wall_id": req.wall_id
    }

# Montar frontend estático si existe dist
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)


