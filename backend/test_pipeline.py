import cv2
import os
from ai_engine import wall_detector
from blending_engine import blending_engine
from catalog_manager import catalog_manager

DEMO_IMG = "/Users/xavieruraga/.gemini/antigravity/scratch/decorwall-ai/backend/demo_rooms/sala_moderna.jpg"
PANEL_IMG = "/Users/xavieruraga/.gemini/antigravity/scratch/decorwall-ai/backend/catalog/madera_alistonada_roble.jpg"
OUTPUT_TEST = "/Users/xavieruraga/.gemini/antigravity/scratch/decorwall-ai/backend/test_output.jpg"

print("1. Cargando imagen de prueba y panel...")
room = cv2.imread(DEMO_IMG)
panel = cv2.imread(PANEL_IMG)
assert room is not None, "Error cargando sala_moderna.jpg"
assert panel is not None, "Error cargando madera_alistonada_roble.jpg"
print(f"Dimensiones de sala: {room.shape}, panel: {panel.shape}")

print("2. Detectando paredes con IA...")
detection = wall_detector.detect_walls_and_foreground(room)
print(f"Paredes detectadas: {len(detection['walls'])}")
for w in detection["walls"]:
    print(f" - {w['name']} (ID: {w['id']}, Área: {w['area_percentage']}%)")

first_wall = detection["walls"][0]
print(f"3. Aplicando panel a {first_wall['name']}...")
result = blending_engine.apply_panel_to_wall(
    room_bgr=room,
    panel_bgr=panel,
    wall_mask=first_wall["mask"],
    foreground_mask=detection["foreground_mask"],
    scale=0.8,
    shading_strength=1.1
)

cv2.imwrite(OUTPUT_TEST, result)
print(f"4. ¡Prueba completada con éxito! Resultado guardado en {OUTPUT_TEST}")
