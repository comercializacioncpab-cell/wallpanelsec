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

print("--- 1. Probando Health Check ---")
res = health_check()
print("Health:", res)
assert res["status"] == "ok"

print("\n--- 2. Probando Listado de Catálogo de Paneles ---")
cat = get_catalog()
panels = cat["panels"]
print(f"Total paneles en catálogo: {len(panels)}")
for p in panels:
    print(f" - [{p['category']}] {p['title']} ({p['id']})")
assert len(panels) >= 6

print("\n--- 3. Probando Habitaciones Demo ---")
demos_res = get_demo_rooms()
demos = demos_res["demos"]
print(f"Total demos: {len(demos)}")
for d in demos:
    print(f" - {d['title']} ({d['id']})")
assert len(demos) >= 2

print("\n--- 4. Probando Carga y Detección de Paredes en Habitación ---")
demo_id = demos[0]["id"]
room_data = load_demo_room(demo_id)
print("Image ID:", room_data["image_id"])
print("Dimensiones:", room_data["dimensions"])
print("Paredes detectadas:", len(room_data["walls"]))
for w in room_data["walls"]:
    print(f" - {w['name']}: {w['area_percentage']}% de la habitación")
assert len(room_data["walls"]) > 0

print("\n--- 5. Probando Renderizado de Panel Decorativo con Sombras y Muebles ---")
selected_wall = room_data["walls"][0]["id"]
selected_panel = panels[0]["id"]
req = ApplyDecorRequest(
    image_id=room_data["image_id"],
    wall_id=selected_wall,
    panel_id=selected_panel,
    scale=0.9,
    rotation=0,
    shading_strength=1.1
)
apply_res = apply_decor(req)
assert apply_res["success"] is True
print("Result URL:", apply_res["result_url"])
print("Result Base64 longitud:", len(apply_res["result_base64"]))

print("\n--- 6. Verificando Distribución del Frontend ---")
index_html = os.path.join(FRONTEND_DIST, "index.html")
assert os.path.exists(index_html), "frontend/dist/index.html debe existir"
print(f"Frontend dist verificado: {index_html}")

print("\n🎉 ¡TODAS LAS FUNCIONES Y MÓDULOS DECORWALL AI OPERAN AL 100%! 🎉")
