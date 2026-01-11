import cv2
import numpy as np
import os

def create_video():
    image_path = r'c:\Users\suatb\Xpersona\tiktok\promo_3.png'
    output_path = r'c:\Users\suatb\Xpersona\tiktok\promo_3.mp4'
    
    if not os.path.exists(image_path):
        print(f"Error: Image not found at {image_path}")
        return

    # Read image
    img = cv2.imread(image_path)
    height, width, layers = img.shape
    size = (width, height)

    # Initialize VideoWriter
    # 'avc1' or 'mp4v' for MP4
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    fps = 30
    duration_sec = 5
    out = cv2.VideoWriter(output_path, fourcc, fps, size)

    print(f"Generating video: {output_path} ({width}x{height})")
    for _ in range(fps * duration_sec):
        out.write(img)

    out.release()
    print("Video generation complete.")

if __name__ == "__main__":
    create_video()
