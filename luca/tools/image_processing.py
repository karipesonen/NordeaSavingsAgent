import base64
from pathlib import Path
from PIL import Image
from langchain.tools import tool
import io

@tool
def read_image(image_path: str, max_size: int = 1024) -> str:
    """Read and encode a local image file, resizing if needed to fit token limits."""
    path = Path(image_path)
    
    with Image.open(path) as img:
        # Convert RGBA to RGB if needed (for JPEG)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        # Resize if larger than max_size on either dimension
        img.thumbnail((max_size, max_size), Image.LANCZOS)
        
        # Save compressed to buffer
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=75)
        buffer.seek(0)
        
        data = base64.b64encode(buffer.read()).decode()
    
    return f"data:image/jpeg;base64,{data}"