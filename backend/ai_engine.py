import cv2
import numpy as np
from PIL import Image
import os

class WallDetectorAI:
    def __init__(self):
        self.min_wall_area_ratio = 0.04

    def detect_walls_and_foreground(self, image_bgr: np.ndarray):
        """
        Analiza la imagen de la habitación e identifica:
        1. Las diferentes paredes detectadas (con sus polígonos y máscaras).
        2. La máscara de elementos en primer plano (muebles, plantas, lámparas, etc.).
        """
        h, w = image_bgr.shape[:2]
        total_pixels = h * w

        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)

        # 1. Suavizado bilateral para reducir ruido manteniendo bordes marcados
        filtered_l = cv2.bilateralFilter(l_channel, d=9, sigmaColor=75, sigmaSpace=75)

        # 2. Detección de bordes canny
        edges = cv2.Canny(filtered_l, 25, 90)
        edges_dilated = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)), iterations=1)

        # 3. Detección de textura de muebles (capitoné, pliegues, botones, cojines)
        # Los muebles suelen tener variación laplaciana densa en la mitad inferior
        laplacian = np.abs(cv2.Laplacian(gray, cv2.CV_32F))
        texture_energy = cv2.GaussianBlur(laplacian, (21, 21), 0)
        
        # Máscara de textura de muebles / alfombras / suelo
        has_texture = (texture_energy > 4.5).astype(np.uint8) * 255

        # 4. Estimación de silueta superior de muebles (Horizonte de muebles)
        # La pared típicamente ocupa la sección superior de la foto (hacia el techo).
        # Los sofás y respaldos definen una línea de silueta por debajo de la cual hay muebles.
        sobel_h = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        horizontal_edges = np.abs(sobel_h) > 28
        
        # 5. Máscara de primer plano (Foreground)
        foreground_mask = np.zeros((h, w), dtype=np.uint8)
        
        # En la mitad inferior (y > h * 0.30), las zonas con textura o contornos pertenecen al sofá/muebles
        lower_region = np.zeros((h, w), dtype=np.uint8)
        lower_region[int(h * 0.28):, :] = 255
        
        furniture_cues = cv2.bitwise_and(has_texture, lower_region)
        furniture_cues = cv2.dilate(furniture_cues, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))

        # Detección de contornos cerrados de cojines o muebles
        contours, _ = cv2.findContours(edges_dilated, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if 400 < area < (total_pixels * 0.50):
                x, y, cw, ch = cv2.boundingRect(cnt)
                # Si el contorno está en la zona del sofá (y > 25% de la altura)
                if y + ch * 0.5 > h * 0.25:
                    cv2.drawContours(foreground_mask, [cnt], -1, 255, -1)

        foreground_mask = cv2.bitwise_or(foreground_mask, furniture_cues)
        foreground_mask = cv2.morphologyEx(foreground_mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11)))

        # 6. Detección de la pared
        # Regiones lisas o con líneas verticales de pared
        smooth_regions = (edges_dilated == 0).astype(np.uint8) * 255
        
        # La pared no debe solapar con los muebles del primer plano
        wall_candidates = cv2.bitwise_and(smooth_regions, cv2.bitwise_not(foreground_mask))
        
        # Dar prioridad a la región superior (zona natural de paredes en habitaciones)
        wall_candidates = cv2.morphologyEx(wall_candidates, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15)))
        wall_candidates = cv2.morphologyEx(wall_candidates, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7)))

        # Separar por componentes conexos
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(wall_candidates, connectivity=8)

        walls = []
        wall_idx = 1
        
        areas = stats[1:, cv2.CC_STAT_AREA]
        if len(areas) > 0:
            sorted_indices = np.argsort(-areas)
            for i in sorted_indices:
                label_id = i + 1
                area = stats[label_id, cv2.CC_STAT_AREA]
                area_ratio = area / total_pixels

                if area_ratio >= self.min_wall_area_ratio:
                    mask_i = (labels == label_id).astype(np.uint8) * 255
                    cx, cy = centroids[label_id]
                    x_stat, y_stat, w_stat, h_stat, _ = stats[label_id]

                    contours_i, _ = cv2.findContours(mask_i, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    if not contours_i:
                        continue
                    main_contour = max(contours_i, key=cv2.contourArea)
                    epsilon = 0.005 * cv2.arcLength(main_contour, True)
                    approx_poly = cv2.approxPolyDP(main_contour, epsilon, True)
                    poly_points = [{"x": float(pt[0][0]), "y": float(pt[0][1])} for pt in approx_poly]

                    if cx < w * 0.35:
                        pos_name = f"Pared Izquierda ({wall_idx})"
                    elif cx > w * 0.65:
                        pos_name = f"Pared Derecha ({wall_idx})"
                    else:
                        pos_name = f"Pared Central / Fondo ({wall_idx})"

                    walls.append({
                        "id": f"wall_{wall_idx}",
                        "name": pos_name,
                        "area_percentage": round(area_ratio * 100, 1),
                        "centroid": {"x": float(cx), "y": float(cy)},
                        "bounding_box": {"x": int(x_stat), "y": int(y_stat), "width": int(w_stat), "height": int(h_stat)},
                        "polygon": poly_points,
                        "mask": mask_i
                    })
                    wall_idx += 1

        # Si el umbral estricto no encontró suficiente área, generar pared superior de acento limpia
        if not walls:
            fallback_mask = np.zeros((h, w), dtype=np.uint8)
            fallback_mask[0:int(h * 0.40), :] = 255
            fallback_mask = cv2.bitwise_and(fallback_mask, cv2.bitwise_not(foreground_mask))

            walls.append({
                "id": "wall_1",
                "name": "Pared Superior de Fondo",
                "area_percentage": round(float(np.sum(fallback_mask > 0)) / total_pixels * 100, 1),
                "centroid": {"x": float(w / 2), "y": float(h * 0.2)},
                "bounding_box": {"x": 0, "y": 0, "width": w, "height": int(h * 0.4)},
                "polygon": [
                    {"x": 0.0, "y": 0.0},
                    {"x": float(w), "y": 0.0},
                    {"x": float(w), "y": float(h * 0.38)},
                    {"x": 0.0, "y": float(h * 0.38)}
                ],
                "mask": fallback_mask
            })

        return {
            "walls": walls,
            "foreground_mask": foreground_mask
        }

    def segment_at_point(self, image_bgr: np.ndarray, click_x: int, click_y: int):
        h, w = image_bgr.shape[:2]
        click_x = max(0, min(w - 1, click_x))
        click_y = max(0, min(h - 1, click_y))

        flood_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 30, 90)
        edges_dilated = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
        flood_mask[1:h+1, 1:w+1] = (edges_dilated > 0).astype(np.uint8)

        diff = (16, 16, 16)
        temp_img = image_bgr.copy()
        cv2.floodFill(
            temp_img,
            flood_mask,
            (click_x, click_y),
            newVal=(0, 255, 0),
            loDiff=diff,
            upDiff=diff,
            flags=4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY
        )

        extracted_mask = flood_mask[1:h+1, 1:w+1]
        extracted_mask = (extracted_mask == 255).astype(np.uint8) * 255
        extracted_mask = cv2.morphologyEx(extracted_mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        return extracted_mask

wall_detector = WallDetectorAI()
