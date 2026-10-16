import cv2
import numpy as np

class BlendingEngine:
    @staticmethod
    def tile_texture(texture_bgr: np.ndarray, target_w: int, target_h: int, scale: float = 1.0, rotation: int = 0) -> np.ndarray:
        """
        Escala, rota y repite periódicamente la textura del panel sobre el lienzo objetivo.
        Soporta escalas ultra pequeñas (ej: 0.05x para listones muy finos y tupidos).
        """
        tex_h, tex_w = texture_bgr.shape[:2]

        # 1. Rotación si se especifica
        if rotation == 90:
            texture_bgr = cv2.rotate(texture_bgr, cv2.ROTATE_90_CLOCKWISE)
        elif rotation == 180:
            texture_bgr = cv2.rotate(texture_bgr, cv2.ROTATE_180)
        elif rotation == 270:
            texture_bgr = cv2.rotate(texture_bgr, cv2.ROTATE_90_COUNTERCLOCKWISE)

        tex_h, tex_w = texture_bgr.shape[:2]

        # 2. Escala referenciada a dimensiones reales del panel (1.10 m de ancho x 2.80 m de alto)
        # En una habitación residencial estándar, la altura de piso a techo es ~2.60m a 2.80m.
        # Por tanto, a escala 1.0x, un panel de 2.80m cubre la altura completa de la pared (target_h)
        # y su ancho proporcional físico (1.10m) equivale a: target_h * (1.10 / 2.80) = target_h * 0.392857.
        panel_ref_h = float(target_h)
        panel_ref_w = panel_ref_h * (1.10 / 2.80)

        scale = max(0.02, float(scale))
        new_w = max(16, int(panel_ref_w * scale))
        new_h = max(16, int(panel_ref_h * scale))

        # Interpolación LANCZOS4 o AREA para mantener la veta y los listones ultra nítidos
        interp = cv2.INTER_AREA if (new_w < tex_w and new_h < tex_h) else cv2.INTER_LANCZOS4
        scaled_tex = cv2.resize(texture_bgr, (new_w, new_h), interpolation=interp)

        # 3. Tiling (repetición horizontal continua simulando paneles yuxtapuestos)
        reps_x = int(np.ceil(target_w / float(new_w))) + 1
        reps_y = int(np.ceil(target_h / float(new_h))) + 1

        tiled = np.tile(scaled_tex, (reps_y, reps_x, 1))
        return tiled[:target_h, :target_w, :]

    @staticmethod
    def order_quad_points(pts) -> np.ndarray:
        """
        Ordena 4 puntos en [TL, TR, BR, BL] de forma 100% geométricamente robusta
        usando ángulos polares respecto al centroide para garantizar que ningún punto se repita.
        """
        raw_pts = []
        for p in pts:
            if isinstance(p, dict):
                raw_pts.append([float(p["x"]), float(p["y"])])
            else:
                raw_pts.append([float(p[0]), float(p[1])])
        arr = np.array(raw_pts, dtype=np.float32)
        if len(arr) != 4:
            return arr

        # Calcular centroide geométrico
        center = np.mean(arr, axis=0)

        # Calcular ángulos polares desde el centroide (-pi a pi)
        angles = np.arctan2(arr[:, 1] - center[1], arr[:, 0] - center[0])

        # Ordenar puntos en secuencia cíclica por ángulo
        sorted_indices = np.argsort(angles)
        sorted_pts = arr[sorted_indices]

        # Encontrar cuál de los 4 vértices es el superior-izquierdo (mínimo x + y)
        sums = sorted_pts[:, 0] + sorted_pts[:, 1]
        tl_idx = int(np.argmin(sums))

        # Reordenar cíclicamente para que TL sea el índice 0 (orden natural en sentido horario)
        ordered = [sorted_pts[(tl_idx + i) % 4] for i in range(4)]
        return np.array(ordered, dtype=np.float32)

    @classmethod
    def warp_texture_perspective(
        cls,
        texture_bgr: np.ndarray,
        quad_pts: list,
        target_w: int,
        target_h: int,
        scale: float = 1.0,
        rotation: int = 0
    ) -> np.ndarray:
        """
        Proyecta la textura continua en perspectiva 3D sobre el cuadrilátero [TL, TR, BR, BL]
        utilizando homografía proyectiva con interpolación Lanczos4.
        """
        dst_quad = cls.order_quad_points(quad_pts) # [TL, TR, BR, BL]

        # Dimensiones en el plano ortogonal antes de proyectar
        width_top = np.linalg.norm(dst_quad[1] - dst_quad[0])
        width_bot = np.linalg.norm(dst_quad[2] - dst_quad[3])
        height_left = np.linalg.norm(dst_quad[3] - dst_quad[0])
        height_right = np.linalg.norm(dst_quad[2] - dst_quad[1])

        plane_w = max(100, min(1600, int(max(width_top, width_bot))))
        plane_h = max(100, min(1600, int(max(height_left, height_right))))

        # Generar textura continua plana a escala proporcional (1.10 x 2.80)
        flat_tiled = cls.tile_texture(texture_bgr, plane_w, plane_h, scale=scale, rotation=rotation)

        src_pts = np.float32([[0, 0], [plane_w, 0], [plane_w, plane_h], [0, plane_h]])
        M = cv2.getPerspectiveTransform(src_pts, dst_quad)

        warped = cv2.warpPerspective(flat_tiled, M, (target_w, target_h), flags=cv2.INTER_LINEAR)
        return warped

    @staticmethod
    def compute_shading_map(original_bgr: np.ndarray, wall_mask: np.ndarray, strength: float = 1.0) -> np.ndarray:
        """
        Extrae el mapa fotométrico de iluminación y sombras de la pared original.
        Preserva sombras arrojadas por muebles, luz de ventanas y halos de lámparas.
        """
        gray = cv2.cvtColor(original_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)

        mask_bool = (wall_mask > 100)
        if not np.any(mask_bool):
            mask_bool = np.ones((original_bgr.shape[0], original_bgr.shape[1]), dtype=bool)

        mean_luminance = float(np.mean(gray[mask_bool]))
        if mean_luminance < 15.0:
            mean_luminance = 128.0

        # Filtro guiado bilateral optimizado con downsampling adaptativo para respuesta instantánea (<20ms) y cero lag
        gh, gw = gray.shape[:2]
        max_shading_dim = 800
        if max(gh, gw) > max_shading_dim:
            down_scale = max_shading_dim / float(max(gh, gw))
            small_gray = cv2.resize(gray.astype(np.uint8), (int(gw * down_scale), int(gh * down_scale)), interpolation=cv2.INTER_AREA)
            small_blurred = cv2.bilateralFilter(small_gray, 7, 75, 75).astype(np.float32)
            blurred_gray = cv2.resize(small_blurred, (gw, gh), interpolation=cv2.INTER_LINEAR)
        else:
            blurred_gray = cv2.bilateralFilter(gray.astype(np.uint8), 7, 75, 75).astype(np.float32)

        # Factor multiplicativo relativo de iluminación
        ratio = blurred_gray / mean_luminance

        # Aplicar fuerza del sombreado con curva de respuesta gamma
        strength = max(0.2, min(2.5, float(strength)))
        shading = np.power(np.clip(ratio, 0.05, 3.0), strength)

        # Clampear a rango natural
        shading = np.clip(shading, 0.15, 2.5)
        return shading[:, :, np.newaxis]

    @classmethod
    def apply_panel_to_wall(
        cls,
        room_bgr: np.ndarray,
        panel_bgr: np.ndarray,
        wall_mask: np.ndarray,
        foreground_mask: np.ndarray = None,
        scale: float = 1.0,
        rotation: int = 0,
        shading_strength: float = 1.0,
        blend_mode: str = "photorealistic",
        perspective_quad: list = None
    ) -> np.ndarray:
        """
        Renderiza el panel decorativo en la pared seleccionada respetando:
        1. Perspectiva 3D por homografía si se provee perspective_quad.
        2. Elementos en primer plano.
        3. Sombras arrojadas e iluminación ambiental real.
        4. Bordes 100% rígidos según solicitud.
        """
        h, w = room_bgr.shape[:2]

        if wall_mask.shape[:2] != (h, w):
            wall_mask = cv2.resize(wall_mask, (w, h), interpolation=cv2.INTER_NEAREST)

        final_mask = wall_mask.copy()
        if foreground_mask is not None:
            if foreground_mask.shape[:2] != (h, w):
                foreground_mask = cv2.resize(foreground_mask, (w, h), interpolation=cv2.INTER_NEAREST)
            final_mask = cv2.bitwise_and(final_mask, cv2.bitwise_not(foreground_mask))

        # Si no hay píxeles en la máscara, pero se envió un cuadrilátero de perspectiva,
        # usar el área de los 4 pines como la máscara de la pared para aplicar la textura
        if np.count_nonzero(final_mask > 20) == 0:
            if perspective_quad and len(perspective_quad) == 4:
                ordered_pts = cls.order_quad_points(perspective_quad)
                cv2.fillPoly(final_mask, [np.int32(ordered_pts)], 255)
            else:
                return room_bgr.copy()

        # 1. Generar la textura (en perspectiva 3D si hay cuadrilátero, u ortogonal plana)
        if perspective_quad and len(perspective_quad) == 4:
            try:
                tiled_panel = cls.warp_texture_perspective(
                    panel_bgr, perspective_quad, w, h, scale=scale, rotation=rotation
                )
            except Exception as e:
                print("[DecorWall AI] Error en warp_texture_perspective, usando fallback ortogonal:", e)
                tiled_panel = cls.tile_texture(panel_bgr, w, h, scale=scale, rotation=rotation)
        else:
            tiled_panel = cls.tile_texture(panel_bgr, w, h, scale=scale, rotation=rotation)

        # 2. Extraer mapa de iluminación fotométrico
        shading = cls.compute_shading_map(room_bgr, final_mask, strength=shading_strength)

        # 3. Fusión fotorealista Multiply + Highlight Preservation
        panel_float = tiled_panel.astype(np.float32)
        shaded_panel_float = panel_float * shading

        # Si la habitación tiene zonas con brillo directo o luz de ventana, añadir brillo suave
        gray_room = cv2.cvtColor(room_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
        highlights = np.clip((gray_room - 215.0) / 40.0, 0.0, 1.0)[:, :, np.newaxis]
        shaded_panel_float = shaded_panel_float * (1.0 - highlights * 0.4) + (255.0 * highlights * 0.4)

        shaded_panel = np.clip(shaded_panel_float, 0.0, 255.0).astype(np.uint8)

        # 4. Bordes 100% rígidos según solicitud (sin fade ni blur suavizante)
        alpha_mask = (final_mask > 80).astype(np.float32)[:, :, np.newaxis]

        # 5. Composición Alpha final con la fotografía original
        room_float = room_bgr.astype(np.float32)
        blended = (room_float * (1.0 - alpha_mask) + shaded_panel.astype(np.float32) * alpha_mask)
        return np.clip(blended, 0.0, 255.0).astype(np.uint8)

blending_engine = BlendingEngine()
