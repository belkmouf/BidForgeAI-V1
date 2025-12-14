#!/usr/bin/env python3
"""
Standalone wrapper for sketch agent.
Called from Node.js via child_process.

Usage:
    python main_standalone.py <image_path> [context]

Returns JSON to stdout with analysis results.
"""

import sys
import json
import asyncio
from pathlib import Path
import os

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from agents.sketch_agent_v2 import SketchAgent
from agents.types import SketchMetadata
from PIL import Image


async def analyze_sketch_cli(image_path: str, context: str = None):
    """
    Analyze sketch from command line.
    
    Args:
        image_path: Path to image file
        context: Optional project context
    
    Returns:
        Exit code (0 for success, 1 for error)
    """
    try:
        # Validate image exists
        if not Path(image_path).exists():
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        # Initialize agent (reads from environment variables)
        agent = SketchAgent()
        
        # Load image
        image = Image.open(image_path)
        
        # Create metadata
        file_stat = Path(image_path).stat()
        metadata = SketchMetadata(
            sketch_id=Path(image_path).stem,
            filename=Path(image_path).name,
            file_size=file_stat.st_size,
            dimensions=image.size,
            uploaded_at=None
        )
        
        # Analyze sketch
        result = await agent.analyze_sketch(image, metadata, context)
        
        # Convert to JSON-serializable dict
        output = {
            "success": True,
            "result": result.model_dump()
        }
        
        # Print JSON to stdout
        print(json.dumps(output, indent=2))
        return 0
        
    except Exception as e:
        # Return error as JSON
        error_output = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }
        print(json.dumps(error_output, indent=2))
        return 1


def main():
    """Main entry point."""
    # Check arguments
    if len(sys.argv) < 2:
        error = {
            "success": False,
            "error": "Missing required argument: image_path",
            "usage": "python main_standalone.py <image_path> [context]"
        }
        print(json.dumps(error))
        sys.exit(1)
    
    # Parse arguments
    image_path = sys.argv[1]
    context = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Run async analysis
    exit_code = asyncio.run(analyze_sketch_cli(image_path, context))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
