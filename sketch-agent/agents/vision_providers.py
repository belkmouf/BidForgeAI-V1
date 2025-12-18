"""Vision model provider implementations for sketch analysis.

Supports 5 vision providers:
- OpenAI (GPT-4o, GPT-4o-mini)
- Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku)
- Google Gemini (Gemini 2.0 Flash, Gemini 1.5 Pro)
- DeepSeek (DeepSeek-Chat via OpenAI-compatible API)
- Qwen (Qwen-VL via DashScope OpenAI-compatible API)
"""

from typing import Protocol, Optional
from PIL import Image
import base64
import io
import os
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
import google.generativeai as genai


class VisionModelProtocol(Protocol):
    """Abstract interface for vision model providers."""

    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> str:
        """Analyze an image and return text response."""
        ...


class OpenAIVisionModel:
    """OpenAI GPT-4o Vision implementation."""

    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY not found in environment")

        self.client = AsyncOpenAI(api_key=self.api_key)
        self.model = model

    def _image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 string."""
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()

    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> str:
        base64_image = self._image_to_base64(image)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens=max_tokens,
            temperature=temperature
        )

        return response.choices[0].message.content or ""


class AnthropicVisionModel:
    """Anthropic Claude 3.5 Sonnet Vision implementation."""

    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-5-sonnet-20241022"):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment")

        self.client = AsyncAnthropic(api_key=self.api_key)
        self.model = model

    def _image_to_base64(self, image: Image.Image) -> str:
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()

    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> str:
        base64_image = self._image_to_base64(image)

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": base64_image
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ]
        )

        content = response.content[0]
        return content.text if content.type == "text" else ""


class GeminiVisionModel:
    """Google Gemini 2.0 Flash Vision implementation."""

    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-2.0-flash-exp"):
        self.api_key = api_key or os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_GENERATIVE_AI_API_KEY not found in environment")

        genai.configure(api_key=self.api_key)
        self.model_name = model
        self.model = genai.GenerativeModel(model)

    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> str:
        generation_config = {
            "max_output_tokens": max_tokens,
            "temperature": temperature
        }

        response = await self.model.generate_content_async(
            [prompt, image],
            generation_config=generation_config
        )

        return response.text


class DeepSeekVisionModel:
    """DeepSeek Vision (OpenAI-compatible) implementation."""

    def __init__(self, api_key: Optional[str] = None, model: str = "deepseek-chat"):
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY not found in environment")

        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://api.deepseek.com"
        )
        self.model = model

    def _image_to_base64(self, image: Image.Image) -> str:
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()

    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> str:
        base64_image = self._image_to_base64(image)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=max_tokens,
            temperature=temperature
        )

        return response.choices[0].message.content or ""


class QwenVisionModel:
    """Qwen VL (DashScope API) implementation."""

    def __init__(self, api_key: Optional[str] = None, model: str = "qwen-vl-max"):
        self.api_key = api_key or os.getenv("DASHSCOPE_API_KEY")
        if not self.api_key:
            raise ValueError("DASHSCOPE_API_KEY not found in environment")

        # Qwen uses OpenAI-compatible API via DashScope
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
        )
        self.model = model

    def _image_to_base64(self, image: Image.Image) -> str:
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()

    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> str:
        base64_image = self._image_to_base64(image)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=max_tokens,
            temperature=temperature
        )

        return response.choices[0].message.content or ""


class VisionModelFactory:
    """Factory for creating vision model instances."""

    PROVIDERS = {
        "openai": OpenAIVisionModel,
        "anthropic": AnthropicVisionModel,
        "gemini": GeminiVisionModel,
        "deepseek": DeepSeekVisionModel,
        "qwen": QwenVisionModel
    }

    @staticmethod
    def create(provider: str, model: Optional[str] = None) -> VisionModelProtocol:
        """Create a vision model instance.

        Args:
            provider: Provider name (openai, anthropic, gemini, deepseek, qwen)
            model: Optional model name override

        Returns:
            Vision model instance

        Raises:
            ValueError: If provider not supported
        """
        provider = provider.lower()

        if provider not in VisionModelFactory.PROVIDERS:
            raise ValueError(
                f"Unsupported provider: {provider}. "
                f"Supported: {', '.join(VisionModelFactory.PROVIDERS.keys())}"
            )

        provider_class = VisionModelFactory.PROVIDERS[provider]

        if model:
            return provider_class(model=model)
        else:
            return provider_class()
