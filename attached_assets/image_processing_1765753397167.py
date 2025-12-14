"""
BidForge AI - Image Processing Utilities
"""

from io import BytesIO
from PIL import Image
from pdf2image import convert_from_bytes


def process_uploaded_file(filename: str, file_bytes: bytes) -> Image.Image:
    """
    Process uploaded file and return PIL Image.
    
    Args:
        filename: Original filename
        file_bytes: File content
    
    Returns:
        PIL Image
    """
    filename_lower = filename.lower()
    
    if filename_lower.endswith('.pdf'):
        # Convert PDF to image
        return convert_pdf_to_image(file_bytes)
    else:
        # Open as image
        return Image.open(BytesIO(file_bytes))


def convert_pdf_to_image(pdf_bytes: bytes, dpi: int = 200) -> Image.Image:
    """
    Convert first page of PDF to image.
    
    Args:
        pdf_bytes: PDF file bytes
        dpi: DPI for conversion
    
    Returns:
        PIL Image of first page
    """
    images = convert_from_bytes(pdf_bytes, dpi=dpi)
    
    if not images:
        raise ValueError("No pages found in PDF")
    
    return images[0]  # Return first page


def optimize_image(
    image: Image.Image,
    max_size: tuple = (2048, 2048),
    quality: int = 85
) -> Image.Image:
    """
    Optimize image for processing.
    
    Args:
        image: Input image
        max_size: Maximum dimensions
        quality: Quality for compression
    
    Returns:
        Optimized image
    """
    # Resize if needed
    if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
    
    # Convert to RGB if needed
    if image.mode not in ('RGB', 'L'):
        image = image.convert('RGB')
    
    return image


def image_to_bytes(image: Image.Image, format: str = 'PNG') -> bytes:
    """Convert PIL Image to bytes."""
    buffered = BytesIO()
    image.save(buffered, format=format)
    return buffered.getvalue()
