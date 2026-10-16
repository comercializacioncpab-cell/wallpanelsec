import os
import sys
sys.path.insert(0, "/Users/xavieruraga/.gemini/antigravity/scratch/decorwall-ai/backend")

from main import (
    health_check,
    get_catalog,
    get_demo_rooms,
    load_demo_room,
    apply_decor,
    ApplyDecorRequest,
    FRONTEND_DIST
)

print("--- 1. Probando Detección Automática de Orientación (Vertical y Horizontal) ---")
demos = get_demo_rooms()["demos"]
for d in demos:
    room_data = load_demo_room(d["id"])
    print(f"Habitación: {d['title']}")
    print(f" - Dimensiones: {room_data['dimensions']['width']}x{room_data['dimensions']['height']}")
    print(f" - Orientación detectada: {room_data['orientation'].upper()}")
    print(f" - Aspect Ratio: {room_data['aspect_ratio']}")
    assert room_data["orientation"] in ["horizontal", "vertical"]
    if "vertical" in d["id"]:
        assert room_data["orientation"] == "vertical", "Debe detectar vertical correctamente"

print("\n--- 2. Probando Selección de Área Personalizada (Custom Box) ---")
panels = get_catalog()["panels"]
vertical_room = load_demo_room("recibidor_vertical.jpg")

custom_box = {
    "x": 150,
    "y": 200,
    "width": 500,
    "height": 450
}
req = ApplyDecorRequest(
    image_id=vertical_room["image_id"],
    panel_id=panels[0]["id"],
    custom_box=custom_box,
    scale=1.0,
    rotation=0,
    shading_strength=1.0
)
res = apply_decor(req)
assert res["success"] is True
print("Resultado con zona personalizada aplicado exitosamente!")
print("Result URL:", res["result_url"])

print("\n🎉 ¡TODAS LAS NUEVAS CAPACIDADES (ORIENTACIÓN + SELECCIÓN DE ÁREA) FUNCIONAN AL 100%! 🎉")
