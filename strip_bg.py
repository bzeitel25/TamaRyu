import sys
import os
from PIL import Image
import math

def remove_magenta_background(image_path):
    print(f"Processing {image_path} with aggressive magenta removal...")
    try:
        img = Image.open(image_path).convert("RGBA")
        data = img.getdata()
        
        new_data = []
        for item in data:
            r, g, b, a = item
            
            # Distance to pure magenta (255, 0, 255)
            dist = math.sqrt((r - 255)**2 + (g - 0)**2 + (b - 255)**2)
            
            # The dragon is black, white, and tan.
            # Its closest color to magenta is white (dist 255) and tan (dist ~218).
            # Any pixel with distance < 180 to magenta is guaranteed to be background or fringe.
            # Also catch dark magenta/purple fringes: if R and B are significantly higher than G.
            if dist < 190 or (r > g + 50 and b > g + 50):
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)
                
        img.putdata(new_data)
        
        base_name = os.path.splitext(image_path)[0]
        out_path = base_name + ".png"
        img.save(out_path, "PNG")
        print(f"Successfully processed {image_path} -> {out_path}")
    except Exception as e:
        print(f"Error processing {image_path}: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python strip_bg.py <image1.jpg> <image2.jpg> ...")
        sys.exit(1)
        
    for arg in sys.argv[1:]:
        remove_magenta_background(arg)
