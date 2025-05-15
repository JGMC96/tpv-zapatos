from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    # Create a new image with white background
    img = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # Calculate dimensions
    margin = size // 10
    box_size = size - 2 * margin
    
    # Draw brown box (representing shoe box)
    draw.rectangle(
        [(margin, margin), (size - margin, size - margin)],
        fill=(121, 85, 72),  # Brown color (#795548)
        outline=(0, 0, 0),
        width=2
    )
    
    # Add "TPV" text
    font_size = int(size * 0.2)
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    text = "TPV"
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    
    # Center the text
    x = (size - text_width) // 2
    y = (size - text_height) // 2
    
    draw.text((x, y), text, font=font, fill=(255, 255, 255))
    
    return img

# Create assets directory if it doesn't exist
if not os.path.exists('docs/assets'):
    os.makedirs('docs/assets')

# Create icons
sizes = [192, 512]
for size in sizes:
    icon = create_icon(size)
    icon.save(f'docs/assets/icon-{size}.png')
    print(f'Created icon-{size}.png')
