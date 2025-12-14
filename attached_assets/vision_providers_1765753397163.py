"""
BidForge AI - Multi-Provider Vision Model Support
Supports: OpenAI, Anthropic, Google Gemini, DeepSeek, Qwen
"""

import os
from typing import Optional, Dict, Any, Protocol
from enum import Enum
import base64
from io import BytesIO
from PIL import Image


class VisionProvider(str, Enum):
    """Supported vision model providers."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    DEEPSEEK = "deepseek"
    QWEN = "qwen"


class VisionModelProtocol(Protocol):
    """Protocol for vision model implementations."""
    
    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str
    ) -> str:
        """Analyze image and return text response."""
        ...


# ============================================================================
# OPENAI (GPT-4 Vision)
# ============================================================================

class OpenAIVisionModel:
    """OpenAI GPT-4 Vision implementation."""
    
    def __init__(
        self,
        model: str = "gpt-4o",
        temperature: float = 0.1,
        max_tokens: int = 2000
    ):
        from openai import AsyncOpenAI
        
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
    
    def _encode_image(self, image: Image.Image) -> str:
        """Convert PIL Image to base64."""
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str
    ) -> str:
        """Analyze image using GPT-4 Vision."""
        image_b64 = self._encode_image(image)
        
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
                                "url": f"data:image/png;base64,{image_b64}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            temperature=self.temperature,
            max_tokens=self.max_tokens
        )
        
        return response.choices[0].message.content


# ============================================================================
# ANTHROPIC (Claude with Vision)
# ============================================================================

class AnthropicVisionModel:
    """Anthropic Claude Vision implementation."""
    
    def __init__(
        self,
        model: str = "claude-3-5-sonnet-20241022",
        temperature: float = 0.1,
        max_tokens: int = 4096
    ):
        from anthropic import AsyncAnthropic
        
        self.client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
    
    def _encode_image(self, image: Image.Image) -> tuple[str, str]:
        """Convert PIL Image to base64 and get media type."""
        buffered = BytesIO()
        format_map = {
            "PNG": "image/png",
            "JPEG": "image/jpeg",
            "JPG": "image/jpeg",
            "WEBP": "image/webp",
            "GIF": "image/gif"
        }
        
        img_format = image.format or "PNG"
        image.save(buffered, format=img_format)
        
        media_type = format_map.get(img_format, "image/png")
        image_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        return image_b64, media_type
    
    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str
    ) -> str:
        """Analyze image using Claude Vision."""
        image_b64, media_type = self._encode_image(image)
        
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64
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
        
        return response.content[0].text


# ============================================================================
# GOOGLE GEMINI
# ============================================================================

class GeminiVisionModel:
    """Google Gemini Vision implementation."""
    
    def __init__(
        self,
        model: str = "gemini-2.0-flash-exp",
        temperature: float = 0.1,
        max_tokens: int = 2000
    ):
        import google.generativeai as genai
        
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
        
        self.model = genai.GenerativeModel(
            model_name=model,
            generation_config={
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            }
        )
        self.temperature = temperature
        self.max_tokens = max_tokens
    
    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str
    ) -> str:
        """Analyze image using Gemini Vision."""
        response = await self.model.generate_content_async([prompt, image])
        return response.text


# ============================================================================
# DEEPSEEK
# ============================================================================

class DeepSeekVisionModel:
    """DeepSeek Vision implementation (via OpenAI-compatible API)."""
    
    def __init__(
        self,
        model: str = "deepseek-chat",
        temperature: float = 0.1,
        max_tokens: int = 2000
    ):
        from openai import AsyncOpenAI
        
        self.client = AsyncOpenAI(
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url="https://api.deepseek.com"
        )
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
    
    def _encode_image(self, image: Image.Image) -> str:
        """Convert PIL Image to base64."""
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str
    ) -> str:
        """Analyze image using DeepSeek."""
        image_b64 = self._encode_image(image)
        
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
                                "url": f"data:image/png;base64,{image_b64}"
                            }
                        }
                    ]
                }
            ],
            temperature=self.temperature,
            max_tokens=self.max_tokens
        )
        
        return response.choices[0].message.content


# ============================================================================
# QWEN (Alibaba)
# ============================================================================

class QwenVisionModel:
    """Qwen Vision implementation."""
    
    def __init__(
        self,
        model: str = "qwen-vl-max",
        temperature: float = 0.1,
        max_tokens: int = 2000
    ):
        from openai import AsyncOpenAI
        
        # Qwen uses OpenAI-compatible API
        self.client = AsyncOpenAI(
            api_key=os.getenv("DASHSCOPE_API_KEY"),  # Alibaba Cloud API key
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
        )
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
    
    def _encode_image(self, image: Image.Image) -> str:
        """Convert PIL Image to base64."""
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str
    ) -> str:
        """Analyze image using Qwen Vision."""
        image_b64 = self._encode_image(image)
        
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
                                "url": f"data:image/png;base64,{image_b64}"
                            }
                        }
                    ]
                }
            ],
            temperature=self.temperature,
            max_tokens=self.max_tokens
        )
        
        return response.choices[0].message.content


# ============================================================================
# PROVIDER FACTORY
# ============================================================================

class VisionModelFactory:
    """Factory for creating vision model instances."""
    
    # Model configurations
    MODELS: Dict[VisionProvider, Dict[str, Any]] = {
        VisionProvider.OPENAI: {
            "class": OpenAIVisionModel,
            "default_model": "gpt-4o",
            "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
            "env_var": "OPENAI_API_KEY"
        },
        VisionProvider.ANTHROPIC: {
            "class": AnthropicVisionModel,
            "default_model": "claude-3-5-sonnet-20241022",
            "models": [
                "claude-3-5-sonnet-20241022",
                "claude-3-opus-20240229",
                "claude-3-sonnet-20240229",
                "claude-3-haiku-20240307"
            ],
            "env_var": "ANTHROPIC_API_KEY"
        },
        VisionProvider.GEMINI: {
            "class": GeminiVisionModel,
            "default_model": "gemini-2.0-flash-exp",
            "models": [
                "gemini-2.0-flash-exp",
                "gemini-1.5-pro",
                "gemini-1.5-flash"
            ],
            "env_var": "GOOGLE_API_KEY"
        },
        VisionProvider.DEEPSEEK: {
            "class": DeepSeekVisionModel,
            "default_model": "deepseek-chat",
            "models": ["deepseek-chat"],
            "env_var": "DEEPSEEK_API_KEY"
        },
        VisionProvider.QWEN: {
            "class": QwenVisionModel,
            "default_model": "qwen-vl-max",
            "models": ["qwen-vl-max", "qwen-vl-plus"],
            "env_var": "DASHSCOPE_API_KEY"
        }
    }
    
    @classmethod
    def create(
        cls,
        provider: VisionProvider,
        model: Optional[str] = None,
        **kwargs
    ) -> VisionModelProtocol:
        """
        Create a vision model instance.
        
        Args:
            provider: Vision provider enum
            model: Optional specific model name
            **kwargs: Additional model parameters
        
        Returns:
            Vision model instance
        """
        config = cls.MODELS[provider]
        
        # Check API key
        api_key = os.getenv(config["env_var"])
        if not api_key:
            raise ValueError(
                f"{provider.value} requires {config['env_var']} environment variable"
            )
        
        # Use default model if not specified
        if model is None:
            model = config["default_model"]
        
        # Validate model
        if model not in config["models"]:
            raise ValueError(
                f"Model {model} not supported for {provider.value}. "
                f"Available: {', '.join(config['models'])}"
            )
        
        # Create instance
        model_class = config["class"]
        return model_class(model=model, **kwargs)
    
    @classmethod
    def get_available_providers(cls) -> list[str]:
        """Get list of providers with valid API keys."""
        available = []
        for provider, config in cls.MODELS.items():
            if os.getenv(config["env_var"]):
                available.append(provider.value)
        return available
    
    @classmethod
    def get_provider_info(cls, provider: VisionProvider) -> Dict[str, Any]:
        """Get information about a provider."""
        config = cls.MODELS[provider]
        return {
            "provider": provider.value,
            "default_model": config["default_model"],
            "available_models": config["models"],
            "requires_api_key": config["env_var"],
            "api_key_configured": bool(os.getenv(config["env_var"]))
        }


# ============================================================================
# CONVENIENCE FUNCTION
# ============================================================================

def get_vision_model(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    **kwargs
) -> VisionModelProtocol:
    """
    Get a vision model instance with automatic provider selection.
    
    Args:
        provider: Provider name (openai, anthropic, gemini, deepseek, qwen)
        model: Specific model name
        **kwargs: Additional model parameters
    
    Returns:
        Vision model instance
    
    Example:
        >>> model = get_vision_model("anthropic", "claude-3-5-sonnet-20241022")
        >>> result = await model.analyze_image(image, prompt)
    """
    # Auto-detect provider from environment
    if provider is None:
        provider = os.getenv("VISION_PROVIDER", "openai")
    
    try:
        provider_enum = VisionProvider(provider.lower())
    except ValueError:
        available = VisionModelFactory.get_available_providers()
        raise ValueError(
            f"Unknown provider: {provider}. Available: {', '.join(available)}"
        )
    
    return VisionModelFactory.create(provider_enum, model, **kwargs)
