import os
import shutil
from typing import List, Dict
from PIL import Image

CATALOG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "catalog"))
DEMO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "demo_rooms"))

class CatalogManager:
    def __init__(self):
        os.makedirs(CATALOG_DIR, exist_ok=True)
        os.makedirs(DEMO_DIR, exist_ok=True)

    def _format_panel_name(self, filename: str) -> str:
        name_no_ext = os.path.splitext(filename)[0]
        # Reemplazar guiones bajos y capitalizar palabras
        return " ".join(word.capitalize() for word in name_no_ext.replace("-", " ").replace("_", " ").split())

    def _infer_category(self, filename: str) -> str:
        f = filename.lower()
        if "madera" in f or "wood" in f or "alistonada" in f or "alistonado" in f or "roble" in f or "nogal" in f or "slat" in f or "miel" in f or "cenizo" in f:
            return "Madera Alistonada"
        elif "marmol" in f or "marble" in f or "calacatta" in f or "marquina" in f:
            return "Mármol y Piedra"
        elif "3d" in f or "chevron" in f or "geometric" in f or "relieve" in f:
            return "Paneles 3D"
        elif "concreto" in f or "cemento" in f or "industrial" in f:
            return "Concreto y Texturas"
        return "General"

    def list_catalog_panels(self) -> List[Dict]:
        if hasattr(self, "_cached_panels") and self._cached_panels:
            return self._cached_panels
        panels = []
        valid_extensions = {".jpg", ".jpeg", ".png", ".webp"}
        
        for fname in sorted(os.listdir(CATALOG_DIR)):
            ext = os.path.splitext(fname)[1].lower()
            if ext in valid_extensions:
                file_path = os.path.join(CATALOG_DIR, fname)
                try:
                    with Image.open(file_path) as im:
                        w, h = im.size
                except Exception:
                    w, h = 1024, 1024

                panels.append({
                    "id": fname,
                    "filename": fname,
                    "title": self._format_panel_name(fname),
                    "category": self._infer_category(fname),
                    "dimensions": {"width": w, "height": h},
                    "url": f"/api/catalog/image/{fname}",
                    "thumbnail_url": f"/api/catalog/image/{fname}"
                })
        self._cached_panels = panels
        return panels

    def list_demo_rooms(self) -> List[Dict]:
        if hasattr(self, "_cached_demos") and self._cached_demos:
            return self._cached_demos
        demos = []
        valid_extensions = {".jpg", ".jpeg", ".png", ".webp"}
        for fname in sorted(os.listdir(DEMO_DIR)):
            if fname.endswith("_mask.png") or fname.endswith("_mask.jpg"):
                continue
            ext = os.path.splitext(fname)[1].lower()
            if ext in valid_extensions:
                demos.append({
                    "id": fname,
                    "filename": fname,
                    "title": self._format_panel_name(fname),
                    "url": f"/api/demo-room/{fname}"
                })
        self._cached_demos = demos
        return demos

    def save_new_panel(self, file_bytes: bytes, original_filename: str) -> Dict:
        self._cached_panels = None
        # Sanitizar nombre de archivo
        base_name = os.path.splitext(os.path.basename(original_filename))[0].lower().replace(" ", "_")
        ext = os.path.splitext(original_filename)[1].lower()
        if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
            ext = ".jpg"

        final_filename = f"{base_name}{ext}"
        counter = 1
        while os.path.exists(os.path.join(CATALOG_DIR, final_filename)):
            final_filename = f"{base_name}_{counter}{ext}"
            counter += 1

        dest_path = os.path.join(CATALOG_DIR, final_filename)
        with open(dest_path, "wb") as f:
            f.write(file_bytes)

        return {
            "id": final_filename,
            "filename": final_filename,
            "title": self._format_panel_name(final_filename),
            "category": self._infer_category(final_filename),
            "url": f"/api/catalog/image/{final_filename}"
        }

catalog_manager = CatalogManager()
