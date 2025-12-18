"""Main sketch analysis agent for construction drawings."""

import json
import time
import os
from pathlib import Path
from typing import Optional
from PIL import Image

from .types import (
    SketchMetadata,
    SketchAnalysisResult
)
from .vision_providers import VisionModelFactory, VisionModelProtocol


class SketchAgent:
    """Main sketch analysis agent for construction drawings.

    Analyzes construction drawings using multimodal vision LLMs and extracts
    structured data about dimensions, materials, specifications, and compliance
    with GCC building standards.
    """

    def __init__(
        self,
        provider: Optional[str] = None,
        model_name: Optional[str] = None
    ):
        """Initialize sketch agent.

        Args:
            provider: Vision provider (openai, anthropic, gemini, deepseek, qwen)
                     If None, uses VISION_PROVIDER env var (defaults to 'openai' for better quality)
            model_name: Optional model override. If None, uses VISION_MODEL env var
        """
        # Determine provider
        self.provider = provider or os.getenv("VISION_PROVIDER", "openai")

        # Determine model
        self.model_name = model_name or os.getenv("VISION_MODEL")

        # Create vision model
        try:
            self.vision_model = VisionModelFactory.create(
                self.provider,
                self.model_name
            )
        except ValueError as e:
            raise ValueError(
                f"Failed to initialize vision provider '{self.provider}': {e}\n"
                f"Make sure the API key is set in environment variables."
            )

        # Load system prompt
        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        """Load system prompt from file."""
        prompt_path = Path(__file__).parent.parent / "prompts" / "sketch_analysis_system.md"

        if not prompt_path.exists():
            raise FileNotFoundError(f"System prompt not found: {prompt_path}")

        return prompt_path.read_text(encoding="utf-8")

    async def analyze_sketch(
        self,
        image: Image.Image,
        metadata: SketchMetadata,
        context: Optional[str] = None
    ) -> SketchAnalysisResult:
        """Analyze a construction drawing/sketch.

        Args:
            image: PIL Image object
            metadata: Sketch metadata (ID, filename, dimensions)
            context: Optional context about the project (e.g., "G+3 residential Dubai")

        Returns:
            Structured analysis result with dimensions, materials, specs, etc.

        Raises:
            ValueError: If vision model returns invalid JSON
            Exception: If analysis fails
        """
        start_time = time.time()

        # Build analysis prompt
        analysis_prompt = self._build_analysis_prompt(metadata, context)

        # Call vision model
        try:
            response = await self.vision_model.analyze_image(
                image=image,
                prompt=analysis_prompt,
                max_tokens=8000,
                temperature=0.1
            )
        except Exception as e:
            raise Exception(f"Vision model analysis failed: {e}")

        # Parse JSON response
        result_dict = self._parse_json_response(response)

        # Add metadata
        result_dict["sketch_id"] = metadata.sketch_id
        result_dict["processing_time"] = time.time() - start_time

        # Validate with Pydantic
        try:
            result = SketchAnalysisResult(**result_dict)
        except Exception as e:
            raise ValueError(f"Failed to validate result: {e}\n\nRaw result: {result_dict}")

        return result

    def _build_analysis_prompt(
        self,
        metadata: SketchMetadata,
        context: Optional[str]
    ) -> str:
        """Build complete analysis prompt combining system prompt with context."""
        prompt_parts = [self.system_prompt]

        if context:
            prompt_parts.append(f"\n## Project Context\n{context}")

        prompt_parts.append(f"\n## Drawing Metadata\n")
        prompt_parts.append(f"- Filename: {metadata.filename}")
        prompt_parts.append(f"- Image dimensions: {metadata.dimensions[0]}x{metadata.dimensions[1]} pixels")

        prompt_parts.append("\n## Task\n")
        prompt_parts.append("Analyze this construction drawing and return ONLY valid JSON following the schema.")

        return "\n".join(prompt_parts)

    def _parse_json_response(self, response: str) -> dict:
        """Parse JSON from vision model response.

        Handles markdown code blocks and extracts clean JSON.

        Args:
            response: Raw text response from vision model

        Returns:
            Parsed dictionary

        Raises:
            ValueError: If JSON is invalid
        """
        # Remove markdown code blocks if present
        cleaned = response.strip()

        if cleaned.startswith("```json"):
            cleaned = cleaned.replace("```json", "", 1)
            cleaned = cleaned.rsplit("```", 1)[0]
        elif cleaned.startswith("```"):
            cleaned = cleaned.replace("```", "", 1)
            cleaned = cleaned.rsplit("```", 1)[0]

        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            raise ValueError(
                f"Invalid JSON response from vision model: {e}\n\n"
                f"Response preview:\n{response[:500]}..."
            )
