import zlib
import struct
import os

def create_png(width, height, raw_rgba):
    # PNG signature
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    
    # IHDR chunk
    ihdr_data = struct.pack('!IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    png.extend(struct.pack('!I', len(ihdr_data)))
    png.extend(b'IHDR')
    png.extend(ihdr_data)
    png.extend(struct.pack('!I', ihdr_crc))
    
    # Raw scanlines with filter byte 0
    scanlines = bytearray()
    for y in range(height):
        scanlines.append(0) # Filter type 0 (None)
        scanlines.extend(raw_rgba[y * width * 4 : (y + 1) * width * 4])
        
    idat_data = zlib.compress(bytes(scanlines))
    idat_crc = zlib.crc32(b'IDAT' + idat_data)
    png.extend(struct.pack('!I', len(idat_data)))
    png.extend(b'IDAT')
    png.extend(idat_data)
    png.extend(struct.pack('!I', idat_crc))
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    png.extend(struct.pack('!I', 0))
    png.extend(b'IEND')
    png.extend(struct.pack('!I', iend_crc))
    
    return bytes(png)

def draw_rect(pixels, w, h, x, y, rw, rh, color):
    for r in range(y, min(h, y + rh)):
        for c in range(x, min(w, x + rw)):
            idx = (r * w + c) * 4
            pixels[idx] = color[0]
            pixels[idx+1] = color[1]
            pixels[idx+2] = color[2]
            pixels[idx+3] = color[3]

def save_sprite(filepath, pixel_drawer_fn):
    w, h = 32, 32
    pixels = bytearray(w * h * 4) # RGBA 0
    pixel_drawer_fn(pixels, w, h)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'wb') as f:
        f.write(create_png(w, h, pixels))
    print(f"Generated sprite: {filepath}")

# 1. Vanguard (Knight with steel armor & shield)
def draw_vanguard(p, w, h):
    draw_rect(p, w, h, 10, 4, 12, 9, (138, 158, 168, 255)) # Helmet
    draw_rect(p, w, h, 13, 7, 6, 3, (80, 200, 120, 255)) # Visor
    draw_rect(p, w, h, 8, 13, 16, 14, (44, 76, 104, 255)) # Plate armor
    draw_rect(p, w, h, 4, 13, 5, 12, (217, 184, 95, 255)) # Gold shield
    draw_rect(p, w, h, 23, 10, 5, 15, (192, 192, 192, 255)) # Sword
    draw_rect(p, w, h, 10, 27, 5, 5, (30, 40, 50, 255)) # Boots
    draw_rect(p, w, h, 17, 27, 5, 5, (30, 40, 50, 255))

# 2. Berserker (Barbarian with battle axe)
def draw_berserker(p, w, h):
    draw_rect(p, w, h, 10, 4, 12, 9, (168, 80, 56, 255)) # Hair/Skin
    draw_rect(p, w, h, 12, 7, 8, 3, (255, 77, 77, 255)) # Warpaint
    draw_rect(p, w, h, 8, 13, 16, 14, (104, 44, 44, 255)) # Leather vest
    draw_rect(p, w, h, 22, 6, 8, 10, (180, 180, 180, 255)) # Axe blade
    draw_rect(p, w, h, 24, 14, 3, 14, (139, 90, 43, 255)) # Handle

# 3. Arcanist (Mage with purple robe & orb)
def draw_arcanist(p, w, h):
    draw_rect(p, w, h, 10, 4, 12, 9, (74, 56, 168, 255)) # Hood
    draw_rect(p, w, h, 12, 7, 8, 3, (121, 201, 232, 255)) # Glowing eyes
    draw_rect(p, w, h, 7, 13, 18, 16, (44, 28, 104, 255)) # Robe
    draw_rect(p, w, h, 3, 8, 4, 22, (139, 90, 43, 255)) # Staff
    draw_rect(p, w, h, 2, 4, 6, 6, (121, 201, 232, 255)) # Orb

# 4. Goblin (Green creature with dagger)
def draw_goblin(p, w, h):
    draw_rect(p, w, h, 10, 6, 12, 10, (58, 120, 56, 255)) # Green head
    draw_rect(p, w, h, 5, 5, 6, 6, (58, 120, 56, 255)) # Big ears
    draw_rect(p, w, h, 21, 5, 6, 6, (58, 120, 56, 255))
    draw_rect(p, w, h, 12, 9, 3, 3, (255, 255, 0, 255)) # Yellow eyes
    draw_rect(p, w, h, 17, 9, 3, 3, (255, 255, 0, 255))
    draw_rect(p, w, h, 9, 16, 14, 12, (88, 56, 32, 255)) # Tattered clothes
    draw_rect(p, w, h, 22, 14, 6, 3, (192, 192, 192, 255)) # Dagger

# 5. Wolf (Dire wolf sprite)
def draw_wolf(p, w, h):
    draw_rect(p, w, h, 6, 12, 20, 12, (90, 96, 104, 255)) # Body
    draw_rect(p, w, h, 18, 6, 10, 10, (90, 96, 104, 255)) # Head
    draw_rect(p, w, h, 22, 9, 3, 3, (255, 77, 77, 255)) # Red eye
    draw_rect(p, w, h, 8, 24, 4, 6, (60, 64, 70, 255)) # Legs
    draw_rect(p, w, h, 18, 24, 4, 6, (60, 64, 70, 255))

# 6. Skeleton (Skeleton warrior)
def draw_skeleton(p, w, h):
    draw_rect(p, w, h, 10, 4, 12, 10, (224, 224, 208, 255)) # Skull
    draw_rect(p, w, h, 12, 7, 3, 3, (0, 0, 0, 255)) # Eye sockets
    draw_rect(p, w, h, 17, 7, 3, 3, (0, 0, 0, 255))
    draw_rect(p, w, h, 14, 14, 4, 12, (224, 224, 208, 255)) # Spine
    draw_rect(p, w, h, 9, 16, 14, 3, (224, 224, 208, 255)) # Ribs

# 7. Boss (Demon boss)
def draw_boss(p, w, h):
    draw_rect(p, w, h, 8, 4, 16, 14, (180, 30, 30, 255)) # Red demon head
    draw_rect(p, w, h, 4, 2, 5, 8, (255, 215, 0, 255)) # Horns
    draw_rect(p, w, h, 23, 2, 5, 8, (255, 215, 0, 255))
    draw_rect(p, w, h, 11, 8, 3, 3, (255, 255, 0, 255)) # Glowing eyes
    draw_rect(p, w, h, 18, 8, 3, 3, (255, 255, 0, 255))
    draw_rect(p, w, h, 6, 18, 20, 12, (120, 20, 20, 255)) # Torso

# Execute generation
save_sprite("assets/entities/player_idle.png", draw_vanguard)
save_sprite("assets/sprites/heroes/vanguard.png", draw_vanguard)
save_sprite("assets/sprites/heroes/berserker.png", draw_berserker)
save_sprite("assets/sprites/heroes/arcanist.png", draw_arcanist)
save_sprite("assets/sprites/monsters/goblin.png", draw_goblin)
save_sprite("assets/sprites/monsters/wolf.png", draw_wolf)
save_sprite("assets/sprites/monsters/skeleton.png", draw_skeleton)
save_sprite("assets/sprites/monsters/boss.png", draw_boss)

print("All pixel PNG sprites generated successfully!")
