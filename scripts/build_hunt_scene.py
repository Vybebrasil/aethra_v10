"""Monta assets/scene/ e js/world/HuntSceneCatalog.js a partir dos packs baixados.

Uso: python scripts/build_hunt_scene.py <pasta com os packs extraídos>
Packs (gratuitos, ver assets/scene/CREDITS.md): LuizMelo (Hero Knight, Martial
Hero 1/2, Fantasy Warrior, Huntress 2, Evil Wizard 1/2, Medieval Warrior 1/2/3,
Medieval King, Monsters Creatures Fantasy 1/2, Pet Dogs), Ninja Adventure,
Legacy Fantasy - High Forest, Parallax Forest. Cada zip extraído numa subpasta.
"""
import json
import sys
import shutil
from pathlib import Path

from PIL import Image, ImageEnhance

X = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "packs"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "scene"
NINJA = X / "Ninja Adventure - Asset Pack" / "Ninja Adventure - Asset Pack"

ALL = [p for p in X.rglob("*.png") if "__MACOSX" not in str(p)]


def find(*parts):
    for p in ALL:
        s = str(p).replace("\\", "/")
        if all(q in s for q in parts):
            return p
    raise SystemExit(f"faltou {parts}")


def rel(path):
    return str(path.relative_to(ROOT)).replace("\\", "/")


def save(img, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, optimize=True)
    return dest


def strip_meta(src, fw, dest):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    frames = max(1, w // fw)
    save(im.crop((0, 0, frames * fw, h)), dest)
    return {"src": rel(dest), "fw": fw, "fh": h, "frames": frames}


def bbox_union(src, fw, frames):
    im = Image.open(src).convert("RGBA")
    box = None
    for i in range(frames):
        b = im.crop((i * fw, 0, (i + 1) * fw, im.size[1])).getbbox()
        if not b:
            continue
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    return box or (0, 0, fw, im.size[1])


catalog = {"actors": {}, "backgrounds": {}, "fx": {}, "props": {}, "credits": []}


def actor(key, group, fw, anims, facing="right", fps=None, idle="idle"):
    """anims: {nome: (parts, fps, loop)}"""
    entry = {"facing": facing, "anims": {}}
    for name, (parts, anim_fps, loop) in anims.items():
        src = find(*parts)
        meta = strip_meta(src, fw, OUT / group / key / f"{name}.png")
        meta.update({"fps": anim_fps, "loop": loop})
        entry["anims"][name] = meta
    first = entry["anims"][idle]
    box = bbox_union(ROOT / first["src"], first["fw"], first["frames"])
    entry["footY"] = box[3]
    entry["centerX"] = round((box[0] + box[2]) / 2)
    entry["height"] = box[3] - box[1]
    entry["width"] = box[2] - box[0]
    catalog["actors"][key] = entry


def ninja_monster(key, folder, fname="SpriteSheet.png", column=1):
    src = NINJA / "Actor" / "Monster" / folder / fname
    im = Image.open(src).convert("RGBA")
    col = [im.crop((column * 16, row * 16, column * 16 + 16, row * 16 + 16)) for row in range(4)]
    strip = Image.new("RGBA", (64, 16))
    for i, frame in enumerate(col):
        strip.paste(frame, (i * 16, 0))
    dest = save(strip, OUT / "monsters" / key / "walk.png")
    meta = {"src": rel(dest), "fw": 16, "fh": 16, "frames": 4}
    box = bbox_union(dest, 16, 4)
    catalog["actors"][key] = {
        "facing": "left", "style": "ninja",
        "anims": {"idle": {**meta, "fps": 4, "loop": True}, "run": {**meta, "fps": 9, "loop": True}},
        "footY": box[3], "centerX": round((box[0] + box[2]) / 2), "height": box[3] - box[1], "width": box[2] - box[0]
    }


# ---------------- Heróis (LuizMelo, CC0) ----------------
actor("vanguard", "heroes", 180, {
    "idle": (("Hero Knight/", "Idle.png"), 10, True), "run": (("Hero Knight/", "Run.png"), 12, True),
    "attack": (("Hero Knight/", "Attack1.png"), 14, False), "attack2": (("Hero Knight/", "Attack2.png"), 14, False),
    "hurt": (("Hero Knight/", "Take Hit.png"), 12, False), "death": (("Hero Knight/", "Death.png"), 10, False)})
actor("berserker", "heroes", 200, {
    "idle": (("Martial Hero/Martial Hero/", "Idle.png"), 10, True), "run": (("Martial Hero/Martial Hero/", "Run.png"), 12, True),
    "attack": (("Martial Hero/Martial Hero/", "Attack1.png"), 14, False), "attack2": (("Martial Hero/Martial Hero/", "Attack2.png"), 14, False),
    "hurt": (("Martial Hero/Martial Hero/", "Take Hit.png"), 12, False), "death": (("Martial Hero/Martial Hero/", "Death.png"), 9, False)})
actor("templar", "heroes", 162, {
    "idle": (("Fantasy Warrior/", "Idle.png"), 10, True), "run": (("Fantasy Warrior/", "Run.png"), 12, True),
    "attack": (("Fantasy Warrior/", "Attack1.png"), 14, False), "attack2": (("Fantasy Warrior/", "Attack3.png"), 14, False),
    "hurt": (("Fantasy Warrior/", "Take hit.png"), 10, False), "death": (("Fantasy Warrior/", "Death.png"), 9, False)})
actor("ranger", "heroes", 100, {
    "idle": (("Huntress 2/", "Character/Idle.png"), 10, True), "run": (("Huntress 2/", "Character/Run.png"), 12, True),
    "attack": (("Huntress 2/", "Character/Attack.png"), 12, False),
    "hurt": (("Huntress 2/", "Character/Get Hit.png"), 10, False), "death": (("Huntress 2/", "Character/Death.png"), 11, False)})
actor("nightblade", "heroes", 200, {
    "idle": (("Martial Hero 2/", "Idle.png"), 7, True), "run": (("Martial Hero 2/", "Run.png"), 12, True),
    "attack": (("Martial Hero 2/", "Attack1.png"), 12, False), "attack2": (("Martial Hero 2/", "Attack2.png"), 12, False),
    "hurt": (("Martial Hero 2/", "Take hit.png"), 10, False), "death": (("Martial Hero 2/", "Death.png"), 9, False)})
actor("arcanist", "heroes", 150, {
    "idle": (("Evil Wizard/", "Idle.png"), 10, True), "run": (("Evil Wizard/", "Move.png"), 12, True),
    "attack": (("Evil Wizard/", "Attack.png"), 14, False),
    "hurt": (("Evil Wizard/", "Take Hit.png"), 10, False), "death": (("Evil Wizard/", "Death.png"), 8, False)})

# ---------------- Monstros animados ----------------
MCF = "Monsters_Creatures_Fantasy/"
actor("goblin", "monsters", 150, {
    "idle": ((MCF, "Goblin/Idle.png"), 8, True), "run": ((MCF, "Goblin/Run.png"), 12, True), "attack": ((MCF, "Goblin/Attack.png"), 14, False),
    "hurt": ((MCF, "Goblin/Take Hit.png"), 12, False), "death": ((MCF, "Goblin/Death.png"), 8, False)})
actor("skeleton", "monsters", 150, {
    "idle": ((MCF, "Skeleton/Idle.png"), 8, True), "run": ((MCF, "Skeleton/Walk.png"), 8, True), "attack": ((MCF, "Skeleton/Attack.png"), 14, False),
    "hurt": ((MCF, "Skeleton/Take Hit.png"), 12, False), "death": ((MCF, "Skeleton/Death.png"), 8, False)})
actor("mushroom", "monsters", 150, {
    "idle": ((MCF, "Mushroom/Idle.png"), 8, True), "run": ((MCF, "Mushroom/Run.png"), 12, True), "attack": ((MCF, "Mushroom/Attack.png"), 14, False),
    "hurt": ((MCF, "Mushroom/Take Hit.png"), 12, False), "death": ((MCF, "Mushroom/Death.png"), 8, False)})
actor("eye", "monsters", 150, {
    "idle": ((MCF, "Flying eye/Flight.png"), 12, True), "run": ((MCF, "Flying eye/Flight.png"), 14, True), "attack": ((MCF, "Flying eye/Attack.png"), 14, False),
    "hurt": ((MCF, "Flying eye/Take Hit.png"), 12, False), "death": ((MCF, "Flying eye/Death.png"), 8, False)})
MCF2 = "Monsters Creatures Fantasy 2/"
actor("rat", "monsters", 70, {
    "idle": ((MCF2, "Rat/idle.png"), 10, True), "run": ((MCF2, "Rat/run.png"), 14, True), "attack": ((MCF2, "Rat/attack_bite.png"), 20, False),
    "hurt": ((MCF2, "Rat/hurt.png"), 12, False), "death": ((MCF2, "Rat/rat-death.png"), 10, False)})
actor("bat", "monsters", 87, {
    "idle": ((MCF2, "Bat/fly.png"), 14, True), "run": ((MCF2, "Bat/fly.png"), 16, True), "attack": ((MCF2, "Bat/attack.png"), 18, False),
    "hurt": ((MCF2, "Bat/hurt.png"), 12, False), "death": ((MCF2, "Bat/death.png"), 8, False)}, facing="front")
actor("slime", "monsters", 156, {
    "idle": ((MCF2, "Slime/idle.png"), 12, True), "run": ((MCF2, "Slime/walk.png"), 10, True), "attack": ((MCF2, "Slime/attack.png"), 24, False),
    "hurt": ((MCF2, "Slime/hurt.png"), 12, False), "death": ((MCF2, "Slime/death.png"), 14, False)})
actor("mimic", "monsters", 146, {
    "idle": ((MCF2, "Mimic/idle_transformed.png"), 10, True), "run": ((MCF2, "Mimic/walk.png"), 10, True), "attack": ((MCF2, "Mimic/attack_1.png"), 20, False),
    "hurt": ((MCF2, "Mimic/hurt.png"), 12, False), "death": ((MCF2, "Mimic/death.png"), 9, False)}, facing="front")
actor("bandit", "monsters", 150, {
    "idle": (("Medieval Warrior Pack 2/", "Idle.png"), 10, True), "run": (("Medieval Warrior Pack 2/", "Run.png"), 12, True),
    "attack": (("Medieval Warrior Pack 2/", "Attack1.png"), 12, False), "hurt": (("Medieval Warrior Pack 2/", "Take Hit.png"), 12, False),
    "death": (("Medieval Warrior Pack 2/", "Death.png"), 9, False)})
actor("brute", "monsters", 184, {
    "idle": (("Medieval Warrior Pack/", "/Idle.png"), 9, True), "run": (("Medieval Warrior Pack/", "/Run.png"), 12, True),
    "attack": (("Medieval Warrior Pack/", "/Attack1.png"), 10, False), "hurt": (("Medieval Warrior Pack/", "/Hit.png"), 10, False),
    "death": (("Medieval Warrior Pack/", "/Death.png"), 12, False)})
actor("warlock", "monsters", 250, {
    "idle": (("EVil Wizard 2/", "Idle.png"), 10, True), "run": (("EVil Wizard 2/", "Run.png"), 12, True),
    "attack": (("EVil Wizard 2/", "Attack1.png"), 14, False), "hurt": (("EVil Wizard 2/", "Take hit.png"), 10, False),
    "death": (("EVil Wizard 2/", "Death.png"), 9, False)})
actor("king", "monsters", 155, {
    "idle": (("Medieval King Pack/", "Idle.png"), 9, True), "run": (("Medieval King Pack/", "Run.png"), 12, True),
    "attack": (("Medieval King Pack/", "Attack_1.png"), 12, False), "hurt": (("Medieval King Pack/", "Hit.png"), 10, False),
    "death": (("Medieval King Pack/", "Death.png"), 12, False)})
actor("knight", "monsters", 135, {
    "idle": (("Medieval Warrior Pack 3/", "Idle.png"), 10, True), "run": (("Medieval Warrior Pack 3/", "Run.png"), 10, True),
    "attack": (("Medieval Warrior Pack 3/", "Attack1.png"), 10, False), "hurt": (("Medieval Warrior Pack 3/", "Get Hit.png"), 10, False),
    "death": (("Medieval Warrior Pack 3/", "Death.png"), 12, False)})
actor("wolf", "monsters", 100, {
    "idle": (("Siberian-Husky-Idle.png",), 9, True), "run": (("Siberian-Husky-run.png",), 14, True),
    "attack": (("Siberian-Husky-bark.png",), 10, False)})
actor("bigdog", "monsters", 100, {
    "idle": (("Saint-Bernard-Idle.png",), 9, True), "run": (("Saint-Bernard-run.png",), 14, True),
    "attack": (("Saint-Bernard-bark.png",), 10, False)})
actor("boar", "monsters", 48, {
    "idle": (("Boar/Idle/Idle-Sheet.png",), 8, True), "run": (("Boar/Run/Run-Sheet.png",), 12, True),
    "hurt": (("Boar/Hit-Vanish/Hit-Sheet.png",), 10, False)}, facing="left")
actor("bee", "monsters", 64, {
    "idle": (("Small Bee/Fly/Fly-Sheet.png",), 12, True), "run": (("Small Bee/Fly/Fly-Sheet.png",), 14, True),
    "attack": (("Small Bee/Attack/Attack-Sheet.png",), 14, False), "hurt": (("Small Bee/Hit/Hit-Sheet.png",), 12, False)}, facing="left")

# ---------------- Monstros do Ninja Adventure (perfil, coluna esquerda) ----------------
for key, folder, fname in [
    ("bear", "Bear", "SpriteSheet.png"), ("spider_red", "SpiderRed", "SpriteSheet.png"), ("spider_yellow", "SpiderYellow", "SpriteSheet.png"),
    ("skull", "Skull", "SpriteSheet.png"), ("spirit", "Spirit", "SpriteSheet.png"), ("cyclope", "Cyclope", "SpriteSheet.png"),
    ("cyclope2", "Cyclope2", "SpriteSheet.png"), ("dragon", "Dragon", "SpriteSheet.png"), ("dragon_yellow", "DragonYellow", "SpriteSheet.png"),
    ("mole", "Mole", "Mole.png"), ("lizard", "Lizard", "Lizard.png"), ("beast", "Beast", "Beast.png"), ("beast2", "Beast2", "Beast2.png"),
    ("larva", "Larva", "Larva.png"), ("snake", "Snake", "Snake.png"), ("owl", "Owl", "Owl.png"), ("flam", "Flam", "SpriteSheet.png"),
    ("reptile", "Reptile", "Reptile.png"), ("trex", "TRex", "SpriteSheet.png"), ("mollusc", "Mollusc", "Mollusc.png")]:
    ninja_monster(key, folder, fname)

# ---------------- Criaturas extras (Gothicvania CC0, Othur, OpenGameArt CC0) ----------------
def strip_frames(src, fw, scale=1.0, resample=Image.NEAREST):
    im = Image.open(src).convert("RGBA")
    frames = []
    for i in range(im.size[0] // fw):
        frame = im.crop((i * fw, 0, (i + 1) * fw, im.size[1]))
        if not frame.getbbox():
            continue
        if scale != 1:
            frame = frame.resize((max(1, round(frame.size[0] * scale)), max(1, round(frame.size[1] * scale))), resample)
        frames.append(frame)
    return frames


def grid_row(src, cell, row, scale=1.0):
    im = Image.open(src).convert("RGBA")
    frames = []
    for i in range(im.size[0] // cell):
        frame = im.crop((i * cell, row * cell, (i + 1) * cell, (row + 1) * cell))
        if frame.getbbox():
            if scale != 1:
                frame = frame.resize((round(cell * scale), round(cell * scale)), Image.LANCZOS)
            frames.append(frame)
    return frames


def file_frames(folder, step=1, scale=1.0, resample=Image.LANCZOS, limit=None):
    files = sorted(f for f in Path(folder).glob("*.png") if "MACOSX" not in str(f))
    files = files[::step]
    if limit:
        files = files[:limit]
    out = []
    for f in files:
        frame = Image.open(f).convert("RGBA")
        if scale != 1:
            frame = frame.resize((max(1, round(frame.size[0] * scale)), max(1, round(frame.size[1] * scale))), resample)
        out.append(frame)
    return out


def custom_actor(key, anims, facing="left", idle="idle"):
    """anims: {nome: (quadros, fps, loop)}; quadros de tamanhos diferentes
    ficam alinhados pela base e pelo centro numa célula comum."""
    cell_w = max(f.size[0] for frames, _, _ in anims.values() for f in frames)
    cell_h = max(f.size[1] for frames, _, _ in anims.values() for f in frames)
    entry = {"facing": facing, "anims": {}}
    for name, (frames, anim_fps, loop) in anims.items():
        strip = Image.new("RGBA", (cell_w * len(frames), cell_h))
        for i, frame in enumerate(frames):
            strip.paste(frame, (i * cell_w + (cell_w - frame.size[0]) // 2, cell_h - frame.size[1]), frame)
        dest = save(strip, OUT / "monsters" / key / f"{name}.png")
        entry["anims"][name] = {"src": rel(dest), "fw": cell_w, "fh": cell_h, "frames": len(frames), "fps": anim_fps, "loop": loop}
    first = entry["anims"][idle]
    box = bbox_union(ROOT / first["src"], first["fw"], first["frames"])
    entry.update({"footY": box[3], "centerX": round((box[0] + box[2]) / 2), "height": box[3] - box[1], "width": box[2] - box[0]})
    catalog["actors"][key] = entry


OTH = X / "othur"
if OTH.exists():
    custom_actor("bear", {
        "idle": (grid_row(OTH / "160x160_idle-loop.png", 160, 2, 0.75), 9, True),
        "run": (grid_row(OTH / "160x160_walk-loop.png", 160, 2, 0.75), 12, True),
        "attack": (grid_row(OTH / "160x160_attack.png", 160, 2, 0.75), 14, False),
        "death": (grid_row(OTH / "160x160_death.png", 160, 2, 0.75), 10, False)})

GV = X / "oga" / "_gothicvania_patreon_collection"


def gv(name):
    return [f for f in GV.rglob(name) if "PSD" not in str(f) and "MACOSX" not in str(f)][0]


if GV.exists():
    custom_actor("hellhound", {
        "idle": (strip_frames(gv("hell-hound-idle.png"), 64), 9, True),
        "run": (strip_frames(gv("hell-hound-run.png"), 67), 12, True)})
    custom_actor("hellbeast", {
        "idle": (strip_frames(gv("hell-beast-idle.png"), 55), 9, True),
        "attack": (strip_frames(gv("hell-beast-breath.png"), 64), 12, False)})
    custom_actor("ghost", {
        "idle": (strip_frames(gv("ghost-idle.png"), 64), 9, True),
        "death": (list(reversed(strip_frames(gv("ghost-appears.png"), 64))), 10, False)})
    custom_actor("demon", {
        "idle": (strip_frames(gv("demon-idle.png"), 160), 8, True),
        "attack": (strip_frames(gv("demon-attack-no-breath.png"), 192), 12, False)})
    custom_actor("fireskull", {
        "idle": (strip_frames(gv("fire-skull.png"), 96), 10, True)})

CEM = X / "oga" / "gothicvania-cemetery-files_1" / "gothicvania-cemetery-files" / "PNG"
if CEM.exists():
    walk = file_frames(CEM / "Sprites" / "skeleton-clothed", resample=Image.NEAREST)
    custom_actor("zombie", {
        "idle": (walk, 8, True),
        "run": (walk, 10, True),
        "death": (file_frames(CEM / "Sprites" / "enemy-death", resample=Image.NEAREST), 10, False)})
    custom_actor("hellcat", {
        "idle": (file_frames(CEM / "Sprites" / "hell-gato", resample=Image.NEAREST), 9, True)})

DRG = X / "oga" / "Dragon_-_Fully_Animated" / "Dragon - Fully Animated"
if DRG.exists():
    custom_actor("drake", {
        "idle": (file_frames(DRG / "Idle Battle", step=7, scale=0.3, limit=20), 10, True),
        "run": (file_frames(DRG / "Walking", step=8, scale=0.3, limit=20), 12, True),
        "attack": (file_frames(DRG / "Attack 1", step=8, scale=0.3, limit=20), 18, False),
        "hurt": (file_frames(DRG / "Hurt", step=6, scale=0.3, limit=10), 14, False),
        "death": (file_frames(DRG / "Death", step=15, scale=0.3, limit=20), 12, False)})

SPD = X / "oga" / "spider_sprites" / "spider"
if SPD.exists():
    custom_actor("bigspider", {
        "idle": (file_frames(SPD / "IDLE", step=2, scale=0.6), 8, True),
        "run": (file_frames(SPD / "WALK", step=2, scale=0.6), 12, True),
        "attack": (file_frames(SPD / "ATTACK", step=2, scale=0.6), 14, False)})

# ---------------- Fundos por zona (parallax) ----------------
def hsv_shift(img, hue=0, sat=1.0, val=1.0):
    alpha = img.getchannel("A")
    h, s, v = img.convert("RGB").convert("HSV").split()
    h = h.point(lambda x: (x + hue) % 256)
    s = s.point(lambda x: max(0, min(255, int(x * sat))))
    v = v.point(lambda x: max(0, min(255, int(x * val))))
    out = Image.merge("HSV", (h, s, v)).convert("RGB").convert("RGBA")
    out.putalpha(alpha)
    return out


V1 = [("back", "v1/layers/parallax-forest-back-trees.png", 0.08), ("lights", "v1/layers/parallax-forest-lights.png", 0.15),
      ("middle", "v1/layers/parallax-forest-middle-trees.png", 0.3), ("front", "v1/layers/parallax-forest-front-trees.png", 0.6)]
V2 = [("back", "v2/layers/back.png", 0.1), ("middle", "v2/layers/middle.png", 0.3), ("front", "v2/layers/front.png", 0.6)]

BACKGROUNDS = {
    "forest": (V1, dict(hue=40, sat=1.0, val=1.0), "#1c2a12"),
    "autumn": (V1, dict(hue=0, sat=1.0, val=1.0), "#20140c"),
    "sunset": (V2, dict(hue=0, sat=1.0, val=1.0), "#140a0a"),
    "crypt": (V1, dict(hue=135, sat=0.55, val=0.55), "#0b0f1a"),
    "hollow": (V1, dict(hue=190, sat=0.6, val=0.5), "#120c18"),
    "swamp": (V1, dict(hue=70, sat=0.55, val=0.62), "#0e1712"),
    "hills": (V2, dict(hue=0, sat=0.25, val=0.8), "#151313"),
    "frost": (V1, dict(hue=125, sat=0.35, val=1.15), "#1a2430"),
    "ember": (V2, dict(hue=245, sat=1.2, val=0.85), "#180808"),
}
for key, (layers, shift, ground) in BACKGROUNDS.items():
    entry = {"ground": ground, "layers": []}
    for name, path, speed in layers:
        src = find("parallax_forest_pack web/", path)
        img = Image.open(src).convert("RGBA")
        img = hsv_shift(img, **shift)
        dest = save(img, OUT / "backgrounds" / key / f"{name}.png")
        entry["layers"].append({"src": rel(dest), "w": img.size[0], "h": img.size[1], "speed": speed,
                                "glow": name == "lights"})
    catalog["backgrounds"][key] = entry


def raw_background(key, layers, ground):
    entry = {"ground": ground, "layers": []}
    for name, src, speed in layers:
        img = Image.open(src).convert("RGBA")
        dest = save(img, OUT / "backgrounds" / key / f"{name}.png")
        entry["layers"].append({"src": rel(dest), "w": img.size[0], "h": img.size[1], "speed": speed, "glow": False})
    catalog["backgrounds"][key] = entry


if CEM.exists():
    env = CEM / "Environment"
    raw_background("graveyard", [("sky", env / "background.png", 0.03), ("mountains", env / "mountains.png", 0.12),
                                 ("graves", env / "graveyard.png", 0.32)], "#0d0b14")
if GV.exists():
    raw_background("nighttown", [("sky", gv("night-town-background-sky.png"), 0.0), ("clouds", gv("night-town-background-clouds.png"), 0.05),
                                 ("mountains", gv("night-town-background-mountains.png"), 0.1), ("buildings", gv("night-town-background-far-buildings.png"), 0.2),
                                 ("town", gv("night-town-background-town.png"), 0.35)], "#0c0a12")

# ---------------- Efeitos (Ninja Adventure) ----------------
def split_by_gaps(src):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    alpha = im.getchannel("A")
    filled = [any(alpha.getpixel((x, y)) for y in range(h)) for x in range(w)]
    spans, start = [], None
    for x, f in enumerate(filled + [False]):
        if f and start is None:
            start = x
        elif not f and start is not None:
            spans.append((start, x))
            start = None
    return im, spans


def fx(key, parts, fps=16, frames=None, uniform=None):
    src = find(*parts)
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    if uniform:
        fw = uniform
        count = w // fw
        cells = [im.crop((i * fw, 0, (i + 1) * fw, h)) for i in range(count)]
    else:
        _, spans = split_by_gaps(src)
        if frames and len(spans) != frames:
            fw = w // frames
            cells = [im.crop((i * fw, 0, (i + 1) * fw, h)) for i in range(frames)]
        else:
            fw = max(b - a for a, b in spans)
            cells = []
            for a, b in spans:
                cell = Image.new("RGBA", (fw, h))
                cell.paste(im.crop((a, 0, b, h)), ((fw - (b - a)) // 2, 0))
                cells.append(cell)
    strip = Image.new("RGBA", (fw * len(cells), h))
    for i, c in enumerate(cells):
        strip.paste(c, (i * fw, 0))
    dest = save(strip, OUT / "fx" / f"{key}.png")
    catalog["fx"][key] = {"src": rel(dest), "fw": fw, "fh": h, "frames": len(cells), "fps": fps}


fx("slash", ("FX/Slash/SpriteSheetSlash01.png",), 18, uniform=26)
fx("slash_big", ("FX/Slash/SpriteSheetSlash02.png",), 18, uniform=66)
fx("slash_arc", ("FX/Slash/SpriteSheetArc.png",), 18, uniform=38)
fx("claw", ("FX/Slash/SpriteSheetMulti.png",), 18, uniform=30)
fx("spark", ("FX/Magic/Spark/SpriteSheet.png",), 16, uniform=30)
fx("heal", ("FX/Magic/Boost/SpriteSheet.png",), 14, uniform=53)
fx("aura", ("FX/Magic/Aura/SpriteSheet.png",), 12, uniform=25)
fx("holy", ("FX/Magic/Circle/SpriteSheetWhite.png",), 14, uniform=32)
fx("smoke", ("FX/Smoke/Smoke/SpriteSheet.png",), 14, uniform=32)
fx("explosion", ("FX/Elemental/Explosion/SpriteSheet.png",), 16, uniform=40)
fx("flame", ("FX/Elemental/Flam/SpriteSheet.png",), 14, uniform=25)
fx("fireball", ("FX/Projectile/Fireball.png",), 12, uniform=16)
fx("leaf", ("FX/Particle/Leaf.png",), 6, uniform=9)
fx("snow", ("FX/Particle/Snow.png",), 6, uniform=8)

# Flecha da Caçadora (estática) e moedas
arrow = find("Huntress 2/", "Arrow/Static.png")
img = Image.open(arrow).convert("RGBA")
catalog["props"]["arrow"] = {"src": rel(save(img.crop((0, 0, 24, img.size[1])), OUT / "props" / "arrow.png")), "w": 24, "h": img.size[1]}
coin = NINJA / "Items" / "Treasure" / "GoldCoin.png"
catalog["props"]["coin"] = {"src": rel(save(Image.open(coin).convert("RGBA"), OUT / "props" / "coin.png")), "w": 7, "h": 7}
chest = NINJA / "Items" / "Treasure" / "BigTreasureChest.png"
ci = Image.open(chest).convert("RGBA")
catalog["props"]["chest"] = {"src": rel(save(ci, OUT / "props" / "chest.png")), "w": ci.size[0] // 2, "h": ci.size[1], "frames": 2}

# Entrada de mina (passagem para o próximo andar), do Legacy Fantasy.
bld = Image.open(find("Assets/Buildings.png")).convert("RGBA").crop((274, 212, 400, 372))
bld = bld.crop(bld.getbbox())
catalog["props"]["entrance"] = {"src": rel(save(bld, OUT / "props" / "entrance.png")), "w": bld.size[0], "h": bld.size[1]}

catalog["credits"] = [
    {"pack": "Hero Knight, Martial Hero 1/2, Fantasy Warrior, Huntress 2, Evil Wizard 1/2, Medieval Warrior 1/2/3, Medieval King, Monsters Creatures Fantasy 1/2, Pet Dogs", "author": "LuizMelo", "url": "https://luizmelo.itch.io/", "license": "CC0"},
    {"pack": "Ninja Adventure", "author": "Pixel-boy & AAA", "url": "https://pixel-boy.itch.io/ninja-adventure-asset-pack", "license": "CC0"},
    {"pack": "Legacy Fantasy - High Forest", "author": "Anokolisa", "url": "https://anokolisa.itch.io/sidescroller-pixelart-sprites-asset-pack-forest-16x16", "license": "Gratuito, uso comercial permitido com crédito"},
    {"pack": "Parallax Forest", "author": "ansimuz", "url": "https://ansimuz.itch.io/parallax-forest", "license": "Gratuito para uso pessoal e comercial"},
    {"pack": "Gothicvania Patreon's Collection, Gothicvania Cemetery", "author": "ansimuz", "url": "https://opengameart.org/content/gothicvania-patreons-collection", "license": "CC0"},
    {"pack": "Dragon - Fully Animated", "author": "Cethiel", "url": "https://opengameart.org/content/dragon-fully-animated", "license": "CC0"},
    {"pack": "Spider (3D art with sprites)", "author": "OpenGameArt", "url": "https://opengameart.org/content/spider-2", "license": "CC0"},
    {"pack": "Bear Sprite", "author": "Othur", "url": "https://othur.itch.io/bear-sprite", "license": "Livre para uso; uso comercial com gorjeta voluntária ao autor"},
]

js = ("// HuntSceneCatalog.js — GERADO por scripts/build_hunt_scene.py: folhas de sprite, fundos e\n"
      "// efeitos da cena de caçada (créditos em assets/scene/CREDITS.md). Só dados.\n"
      "(function (Aethra) {\n    \"use strict\";\n    Aethra.HuntSceneCatalog = "
      + json.dumps(catalog, ensure_ascii=False, indent=4).replace("\n", "\n    ")
      + ";\n})(window.Aethra = window.Aethra || {});\n")
(ROOT / "js" / "world" / "HuntSceneCatalog.js").write_bytes(js.encode("utf-8"))

credits = ["# Créditos da arte da cena de caçada", ""]
for c in catalog["credits"]:
    credits.append(f"- **{c['pack']}** — {c['author']} ({c['url']}) — licença: {c['license']}")
(OUT / "CREDITS.md").write_bytes(("\n".join(credits) + "\n").encode("utf-8"))

total = sum(p.stat().st_size for p in OUT.rglob("*.png"))
print("atores", len(catalog["actors"]), "fundos", len(catalog["backgrounds"]), "fx", len(catalog["fx"]), "bytes", total)
for k, v in catalog["fx"].items():
    print("fx", k, v["fw"], v["fh"], v["frames"])
