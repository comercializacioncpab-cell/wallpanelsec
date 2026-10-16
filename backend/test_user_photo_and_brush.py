import os
import sys
import cv2
import numpy as np
import base64

sys.path.insert(0, "/Users/xavieruraga/.gemini/antigravity/scratch/decorwall-ai/backend")

from main import (
    load_demo_room,
    apply_decor,
    ApplyDecorRequest,
    get_catalog
)

print("--- 1. Cargando la foto real del usuario (sofa_beige_real.jpg) ---")
room_data = load_demo_room("sofa_beige_real.jpg")
print(f"Dimensiones: {room_data['dimensions']['width']}x{room_data['dimensions']['height']}")
print(f"Orientación: {room_data['orientation'].upper()}")
print(f"Paredes detectadas por IA: {len(room_data['walls'])}")
for w in room_data['walls']:
    print(f" - {w['name']}: {w['area_percentage']}% de la imagen")

h = room_data['dimensions']['height']
w = room_data['dimensions']['width']

print("\n--- 2. Simulando trazo de Pincel y Borrador (Custom Mask) ---")
# Creamos una máscara como la que produce el canvas HTML5:
# Pintamos la pared superior (y: 0 a 300) y dejamos libre el sofá (y: 300 a h)
mask = np.zeros((h, w), dtype=np.uint8)
cv2.rectangle(mask, (0, 0), (w, int(h * 0.28)), 255, -1)

# Codificar a PNG base64 (exactamente como hace canvas.toDataURL)
_, buffer = cv2.imencode(".png", mask)
mask_base64 = "data:image/png;base64," + base64.b64encode(buffer).decode("utf-8")

panels = get_catalog()["panels"]
selected_panel = panels[2]["id"] # Madera alistonada roble

print(f"--- 3. Aplicando panel '{selected_panel}' con máscara de Pincel/Borrador ---")
req = ApplyDecorRequest(
    image_id=room_data["image_id"],
    panel_id=selected_panel,
    mask_base64=mask_base64,
    scale=0.8,
    rotation=0,
    shading_strength=1.1
)
res = apply_decor(req)
assert res["success"] is True
print("Transformación exitosa! URL generada:", res["result_url"])

# Verificar que el archivo generado en cache exista y sea válido
saved_result = os.path.join("/Users/xavieruraga/.gemini/antigravity/scratch/decorwall-ai/backend/cache", os.path.basename(res["result_url"]))
assert os.path.exists(saved_result), f"El archivo debe existir en {saved_result}"
test_img = cv2.imread(saved_result)
assert test_img is not None
print("Dimensiones de la imagen transformada:", test_img.shape)

print("\n🎉 ¡LA PRUEBA COMPLETA CON LA FOTO REAL DEL USUARIO PASÓ EXITOSAMENTE! 🎉")
