#!/usr/bin/env python3
"""
Standalone CLI for sketch analysis - called by Node.js via child_process.

Usage:
    python main_standalone.py <image_path> [context]

Returns JSON to stdout:
    Success: {"success": true, "result": {...}}
    Error: {"success": false, "error": "...", "error_type": "..."}

Examples:
    python main_standalone.py uploads/sketch.png
    python main_standalone.py uploads/sketch.png "G+3 residential Dubai Marina"
"""

import sys
import json
import asyncio
import os
from pathlib import Path
from PIL import Image

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from agents.sketch_agent_v2 import SketchAgent
from agents.types import SketchMetadata


async def analyze_sketch_cli(image_path: str, context: str = None):
    """Analyze sketch from command line.

    Args:
        image_path: Path to image file
        context: Optional project context

    Returns:
        Dictionary with success status and result/error
    """
    try:
        # Validate image path
        if not os.path.exists(image_path):
            return {
                "success": False,
                "error": f"Image not found: {image_path}",
                "error_type": "FileNotFoundError"
            }

        # Load image
        try:
            image = Image.open(image_path)
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to load image: {str(e)}",
                "error_type": type(e).__name__
            }

        # Create metadata
        file_stat = os.stat(image_path)
        metadata = SketchMetadata(
            sketch_id=Path(image_path).stem,
            filename=Path(image_path).name,
            file_size=file_stat.st_size,
            dimensions=image.size
        )

        # Initialize agent
        # Provider and model determined from environment variables
        agent = SketchAgent()

        # Analyze
        result = await agent.analyze_sketch(image, metadata, context)

        # Return success
        return {
            "success": True,
            "result": result.model_dump()
        }

    except ValueError as e:
        # Configuration or validation errors
        return {
            "success": False,
            "error": str(e),
            "error_type": "ValueError"
        }
    except Exception as e:
        # Unexpected errors
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }


def main():
    """Main entry point for CLI."""
    # Parse arguments
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python main_standalone.py <image_path> [context]",
            "error_type": "InvalidArguments"
        }))
        sys.exit(1)

    image_path = sys.argv[1]
    context = sys.argv[2] if len(sys.argv) > 2 else None

    # Run analysis
    result = asyncio.run(analyze_sketch_cli(image_path, context))

    # Output JSON to stdout
    print(json.dumps(result, indent=2))

    # Exit code: 0 for success, 1 for failure
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
