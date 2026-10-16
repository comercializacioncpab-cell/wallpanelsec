import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

CATALOG_DIR = "/Users/xavieruraga/.gemini/antigravity/scratch/decorwall-ai/backend/catalog"
DEMO_DIR = "/Users/xavieruraga/.gemini/antigravity/scratch/decorwall-ai/backend/demo_rooms"
os.makedirs(CATALOG_DIR, exist_ok=True)
os.makedirs(DEMO_DIR, exist_ok=True)

def generate_slatted_wood(width=1024, height=1024, wood_color=(198, 142, 85), gap_color=(35, 25, 20), slat_w=40, gap_w=12):
    """Genera panel alistonado de madera con textura de vetas y relieve 3D."""
    img = Image.new("RGB", (width, height), wood_color)
    arr = np.array(img, dtype=np.float32)

    # Añadir vetas orgánicas de madera
    y_coords, x_coords = np.indices((height, width))
    noise = np.sin(y_coords * 0.05 + np.sin(x_coords * 0.02) * 5) * 12
    noise += (np.random.RandomState(42).randn(height, width) * 7)
    
    for c in range(3):
        arr[:, :, c] += noise * (wood_color[c] / 200.0)

    # Dibujar ranuras y sombreado 3D de cada listón
    period = slat_w + gap_w
    for x in range(0, width, period):
        gx1 = x + slat_w
        gx2 = min(width, gx1 + gap_w)
        if gx1 < width:
            arr[:, gx1:gx2, :] = gap_color
        if x + slat_w <= width:
            arr[:, max(0, x + slat_w - 4):x + slat_w, :] *= 0.65  # Sombra lateral
        if x < width:
            arr[:, x:min(width, x + 3), :] = np.clip(arr[:, x:min(width, x + 3), :] * 1.3, 0, 255) # Brillo borde

    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)

def generate_marble(width=1024, height=1024, base_color=(245, 245, 248), vein_color=(110, 105, 95)):
    """Genera losa de mármol de lujo con vetas fractales orgánicas."""
    arr = np.ones((height, width, 3), dtype=np.float32)
    for c in range(3):
        arr[:, :, c] = base_color[c]

    rng = np.random.RandomState(123)
    y, x = np.indices((height, width))
    v = np.zeros((height, width), dtype=np.float32)
    for freq, amp in [(0.004, 1.0), (0.01, 0.5), (0.03, 0.25)]:
        shift = rng.randn() * 100
        v += np.sin(x * freq + y * (freq * 0.7) + np.sin(y * 0.02 + shift) * 3) * amp

    v = np.abs(v)
    vein_mask = np.exp(- (v ** 2) / 0.08)
    
    for c in range(3):
        diff = vein_color[c] - base_color[c]
        arr[:, :, c] += vein_mask * diff

    stone_noise = rng.randn(height, width, 3) * 4
    arr = np.clip(arr + stone_noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr).filter(ImageFilter.GaussianBlur(radius=0.7))

def generate_nero_marquina(width=1024, height=1024):
    """Mármol negro con vetas blancas y doradas."""
    return generate_marble(width, height, base_color=(30, 32, 36), vein_color=(235, 230, 220))

def generate_3d_chevron(width=1024, height=1024):
    """Panel decorativo acústico / 3D en patrón Chevron."""
    img = Image.new("RGB", (width, height), (220, 220, 225))
    arr = np.array(img, dtype=np.float32)
    
    tile_h = 80
    tile_w = 160
    y, x = np.indices((height, width))
    
    x_mod = (x % tile_w) - (tile_w / 2)
    y_mod = y % tile_h
    slope = (np.abs(x_mod) / (tile_w / 2) + y_mod / tile_h) % 1.0
    
    shading = (slope - 0.5) * 60
    for c in range(3):
        arr[:, :, c] += shading

    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)

def generate_concrete(width=1024, height=1024):
    """Panel de concreto arquitectónico / microcemento industrial."""
    rng = np.random.RandomState(77)
    base = np.ones((height, width, 3), dtype=np.float32) * 175
    for _ in range(5):
        rx = rng.randint(0, width, 20)
        ry = rng.randint(0, height, 20)
        for i in range(20):
            y, x = np.ogrid[:height, :width]
            dist = np.sqrt((x - rx[i])**2 + (y - ry[i])**2)
            base -= np.exp(-dist / 120)[:, :, np.newaxis] * rng.uniform(8, 25)
    
    base += rng.randn(height, width, 3) * 5
    base[::256, :, :] *= 0.75
    for py in range(128, height, 256):
        for px in range(128, width, 256):
            y, x = np.ogrid[:height, :width]
            bolt = np.exp(-((x-px)**2 + (y-py)**2) / 60)[:, :, np.newaxis]
            base -= bolt * 80

    base = np.clip(base, 0, 255).astype(np.uint8)
    return Image.fromarray(base)

print("Generando catálogo de paneles decorativos...")
p1 = generate_slatted_wood(slat_w=36, gap_w=10, wood_color=(205, 150, 92), gap_color=(30, 20, 15))
p1.save(os.path.join(CATALOG_DIR, "madera_alistonada_roble.jpg"), quality=95)

p2 = generate_slatted_wood(slat_w=45, gap_w=14, wood_color=(125, 82, 52), gap_color=(20, 15, 12))
p2.save(os.path.join(CATALOG_DIR, "madera_alistonada_nogal.jpg"), quality=95)

p3 = generate_marble()
p3.save(os.path.join(CATALOG_DIR, "marmol_calacatta_gold.jpg"), quality=95)

p4 = generate_nero_marquina()
p4.save(os.path.join(CATALOG_DIR, "marmol_nero_marquina.jpg"), quality=95)

p5 = generate_3d_chevron()
p5.save(os.path.join(CATALOG_DIR, "panel_3d_chevron_blanco.jpg"), quality=95)

p6 = generate_concrete()
p6.save(os.path.join(CATALOG_DIR, "concreto_arquitectonico.jpg"), quality=95)

def generate_demo_living_room():
    w, h = 1200, 800
    img = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    wall_arr = np.zeros((520, w, 3), dtype=np.float32)
    for x in range(w):
        factor = 1.0 - (x / w) * 0.35
        wall_arr[:, x, :] = [238 * factor, 234 * factor, 226 * factor]
    
    draw.rectangle([0, 0, w, 60], fill=(248, 248, 250))
    draw.line([0, 60, w, 60], fill=(210, 210, 215), width=2)

    for y in range(580, h):
        depth = (y - 580) / 220.0
        draw.line([0, y, w, y], fill=(int(170 - depth*30), int(125 - depth*25), int(85 - depth*20)))
    draw.rectangle([0, 565, w, 580], fill=(255, 255, 255))
    draw.line([0, 565, w, 565], fill=(200, 200, 200), width=1)

    room_img = Image.fromarray(np.uint8(np.clip(
        np.vstack([
            np.ones((60, w, 3))*248,
            wall_arr,
            np.ones((220, w, 3))*140
        ]), 0, 255)
    ))
    draw = ImageDraw.Draw(room_img)
    draw.line([0, 580, w, 580], fill=(50, 40, 30), width=2)
    draw.ellipse([260, 440, 940, 620], fill=(70, 65, 60))
    room_img = room_img.filter(ImageFilter.GaussianBlur(radius=8))
    draw = ImageDraw.Draw(room_img)

    draw.rounded_rectangle([320, 420, 880, 580], radius=24, fill=(55, 70, 85))
    draw.rounded_rectangle([300, 500, 900, 630], radius=28, fill=(65, 82, 100))
    draw.rounded_rectangle([350, 460, 460, 540], radius=15, fill=(215, 160, 45))
    draw.rounded_rectangle([740, 460, 850, 540], radius=15, fill=(190, 185, 175))
    draw.line([340, 625, 330, 675], fill=(40, 40, 40), width=6)
    draw.line([860, 625, 870, 675], fill=(40, 40, 40), width=6)
    draw.line([600, 625, 600, 675], fill=(40, 40, 40), width=6)

    draw.line([160, 180, 160, 680], fill=(30, 30, 30), width=5)
    draw.ellipse([120, 675, 200, 690], fill=(25, 25, 25))
    draw.polygon([(110, 240), (210, 240), (190, 180), (130, 180)], fill=(245, 240, 220))
    glow = Image.new("RGBA", (w, h), (0,0,0,0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse([60, 120, 260, 320], fill=(255, 230, 160, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=25))
    room_img.paste(Image.alpha_composite(room_img.convert("RGBA"), glow).convert("RGB"))

    draw = ImageDraw.Draw(room_img)
    draw.polygon([(980, 520), (1060, 520), (1045, 660), (995, 660)], fill=(230, 228, 225))
    for hx, hy in [(970, 450), (1020, 400), (1070, 440), (1010, 480), (940, 490), (1080, 500)]:
        draw.ellipse([hx-40, hy-30, hx+40, hy+30], fill=(42, 98, 55))
        draw.line([1020, 530, hx, hy], fill=(30, 75, 40), width=4)

    return room_img

def generate_demo_bedroom():
    w, h = 1200, 800
    img = Image.new("RGB", (w, h), (240, 240, 242))
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, w, 50], fill=(250, 250, 252))
    draw.rectangle([0, 50, w, 560], fill=(232, 230, 228))
    draw.rectangle([0, 560, w, h], fill=(160, 140, 120))
    draw.rectangle([0, 550, w, 560], fill=(255, 255, 255))

    draw.rounded_rectangle([300, 340, 900, 560], radius=16, fill=(80, 75, 70))
    draw.rectangle([340, 470, 860, 700], fill=(245, 245, 248))
    draw.rounded_rectangle([360, 440, 570, 500], radius=12, fill=(255, 255, 255))
    draw.rounded_rectangle([630, 440, 840, 500], radius=12, fill=(255, 255, 255))
    draw.rectangle([340, 600, 860, 690], fill=(175, 140, 110))

    draw.rectangle([180, 480, 280, 580], fill=(60, 50, 45))
    draw.rectangle([920, 480, 1020, 580], fill=(60, 50, 45))
    draw.line([230, 50, 230, 380], fill=(20, 20, 20), width=2)
    draw.ellipse([215, 380, 245, 410], fill=(230, 180, 70))
    draw.line([970, 50, 970, 380], fill=(20, 20, 20), width=2)
    draw.ellipse([955, 380, 985, 410], fill=(230, 180, 70))

    return img

print("Generando habitaciones de demostración...")
r1 = generate_demo_living_room()
r1.save(os.path.join(DEMO_DIR, "sala_moderna.jpg"), quality=95)

r2 = generate_demo_bedroom()
r2.save(os.path.join(DEMO_DIR, "dormitorio_master.jpg"), quality=95)

print("¡Assets iniciales generados con éxito!")
