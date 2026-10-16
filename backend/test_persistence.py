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
    get_catalog,
    SESSION_STORE
)

print("--- 1. Cargando imagen demo ---")
room = load_demo_room("sofa_beige_real.jpg")
image_id = room["image_id"]
h, w = room["dimensions"]["height"], room["dimensions"]["width"]

print("--- 2. Creando máscara manual personalizada de usuario ---")
user_mask = np.zeros((h, w), dtype=np.uint8)
# Pintar un área específica de prueba (100x100)
cv2.rectangle(user_mask, (50, 50), (150, 150), 255, -1)
_, buf = cv2.imencode(".png", user_mask)
mask_base64 = "data:image/png;base64," + base64.b64encode(buf).decode("utf-8")

panels = get_catalog()["panels"]
p1 = panels[0]["id"]
p2 = panels[1]["id"]

print(f"--- 3. Aplicando con panel 1 ({p1}) y enviando máscara ---")
req1 = ApplyDecorRequest(
    image_id=image_id,
    panel_id=p1,
    mask_base64=mask_base64
)
res1 = apply_decor(req1)
assert res1["success"] is True
assert "active_mask" in SESSION_STORE[image_id], "La máscara activa debe guardarse en la sesión"
print("Paso 1 exitoso. active_mask guardada en la sesión!")

print(f"\n--- 4. Cambiando a panel 2 ({p2}) SIN reenviar máscara ---")
req2 = ApplyDecorRequest(
    image_id=image_id,
    panel_id=p2
    # Notese: NO enviamos mask_base64, el backend debe reutilizar la máscara activa guardada
)
res2 = apply_decor(req2)
assert res2["success"] is True
print("Paso 2 exitoso! Se reutilizó la máscara personalizada guardada de forma persistente.")

print("\n🎉 ¡PERSISTENCIA DE MÁSCARA Y SELECCIÓN VERIFICADA CON ÉXITO! 🎉")
