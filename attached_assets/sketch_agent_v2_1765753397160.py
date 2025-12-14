"""
BidForge AI - Sketch Analysis Agent (Multi-Provider)
Core agent for processing construction sketches
Supports: OpenAI, Anthropic, Google Gemini, DeepSeek, Qwen
"""

from __future__ import annotations
import os
import json
from typing import List, Optional
from datetime import datetime

from PIL import Image
from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph, END

from .vision_providers import get_vision_model
from .types import (
    SketchAnalysisOutput,
    SketchMetadata,
    AgentState,
    DocumentType,
    ProjectPhase,
    DimensionData,
    MaterialData,
    ComponentData
)


class SketchAgent:
    """
    Autonomous agent for analyzing construction sketches.
    Uses multiple vision providers (OpenAI, Anthropic, Gemini, DeepSeek, Qwen).
    """
    
    def __init__(
        self,
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 2000,
        system_prompt_path: Optional[str] = None
    ):
        """
        Initialize Sketch Agent with multi-provider support.
        
        Args:
            provider: Vision provider (openai, anthropic, gemini, deepseek, qwen)
            model_name: Specific model name (uses provider default if None)
            temperature: LLM temperature
            max_tokens: Maximum tokens for response
            system_prompt_path: Path to custom system prompt
        """
        # Auto-detect provider from environment or use default
        self.provider = provider or os.getenv("VISION_PROVIDER", "openai")
        self.model_name = model_name or os.getenv("VISION_MODEL")
        
        # Initialize vision model
        self.vision_model = get_vision_model(
            provider=self.provider,
            model=self.model_name,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        # Load system prompt
        if system_prompt_path and os.path.exists(system_prompt_path):
            with open(system_prompt_path, "r", encoding="utf-8") as f:
                self.system_prompt = f.read()
        else:
            self.system_prompt = self._get_default_prompt()
    
    def _get_default_prompt(self) -> str:
        """Get default system prompt - loads from prompts/sketch_analysis_system.md if available."""
        prompt_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "prompts",
            "sketch_analysis_system.md"
        )
        
        if os.path.exists(prompt_path):
            with open(prompt_path, "r", encoding="utf-8") as f:
                return f.read()
        
        # Fallback prompt
        return """Analyze construction sketches and extract structured data in JSON format."""
    
    async def analyze_sketch(
        self,
        image: Image.Image,
        metadata: SketchMetadata,
        context: Optional[str] = None
    ) -> SketchAnalysisOutput:
        """Analyze a single construction sketch using configured vision provider."""
        start_time = datetime.now()
        
        try:
            # Build complete prompt
            context_msg = f"""
**Sketch Details**:
- Filename: {metadata.filename}
- Dimensions: {metadata.dimensions[0]}x{metadata.dimensions[1]} pixels
"""
            if context:
                context_msg += f"\n**Project Context**: {context}"
            
            full_prompt = f"""{self.system_prompt}

{context_msg}

Analyze this construction sketch thoroughly and provide complete structured JSON output."""
            
            # Call vision model (works with any provider)
            response = await self.vision_model.analyze_image(image, full_prompt)
            
            # Parse response
            data = self._extract_json(response)
            
            # Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds()
            
            # Build structured output
            return self._build_output(data, metadata.sketch_id, processing_time)
            
        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            return self._build_error_output(metadata.sketch_id, str(e), processing_time)
    
    def _extract_json(self, content: str) -> dict:
        """Extract JSON from response."""
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            start = content.find('{')
            end = content.rfind('}')
            if start != -1 and end != -1 and start < end:
                return json.loads(content[start:end + 1])
            raise ValueError("No valid JSON found in response")
    
    def _build_output(self, data: dict, sketch_id: str, processing_time: float) -> SketchAnalysisOutput:
        """Build SketchAnalysisOutput from parsed data."""
        dimensions = [
            DimensionData(**dim) if isinstance(dim, dict) else DimensionData(
                type="unknown", value=0.0, unit="unknown", confidence=50.0
            )
            for dim in data.get('dimensions', [])
        ]
        
        materials = [
            MaterialData(**mat) if isinstance(mat, dict) else MaterialData(
                name=str(mat), confidence=70.0
            )
            for mat in data.get('materials', [])
        ]
        
        components = [
            ComponentData(**comp) if isinstance(comp, dict) else ComponentData(
                type=str(comp), confidence=70.0
            )
            for comp in data.get('components', [])
        ]
        
        return SketchAnalysisOutput(
            sketch_id=sketch_id,
            document_type=DocumentType(data.get('document_type', 'unknown')),
            project_phase=ProjectPhase(data.get('project_phase', 'unknown')),
            dimensions=dimensions,
            materials=materials,
            specifications=data.get('specifications', []),
            components=components,
            quantities=data.get('quantities', {}),
            standards=data.get('standards', []),
            regional_codes=data.get('regional_codes', []),
            annotations=data.get('annotations', []),
            revisions=data.get('revisions', []),
            confidence_score=float(data.get('confidence_score', 80.0)),
            processing_time=processing_time,
            notes=data.get('notes', ''),
            warnings=data.get('warnings', []),
            embeddings_ready=False
        )
    
    def _build_error_output(self, sketch_id: str, error: str, processing_time: float) -> SketchAnalysisOutput:
        """Build error output."""
        return SketchAnalysisOutput(
            sketch_id=sketch_id,
            document_type=DocumentType.UNKNOWN,
            project_phase=ProjectPhase.UNKNOWN,
            confidence_score=0.0,
            processing_time=processing_time,
            notes=f"Analysis failed: {error}",
            warnings=[f"Error: {error}"]
        )
    
    async def process_multiple_sketches(
        self,
        images: List[Image.Image],
        metadata_list: List[SketchMetadata],
        context: Optional[str] = None
    ) -> List[SketchAnalysisOutput]:
        """Process multiple sketches."""
        results = []
        for image, metadata in zip(images, metadata_list):
            result = await self.analyze_sketch(image, metadata, context)
            results.append(result)
        return results
    
    def to_embeddings_input(self, analysis: SketchAnalysisOutput) -> str:
        """Format analysis for vector embedding."""
        sections = [
            f"Document Type: {analysis.document_type.value}",
            f"Project Phase: {analysis.project_phase.value}",
            "",
            "Technical Specifications:",
            *[f"- {spec}" for spec in analysis.specifications],
            "",
            "Components:",
            *[f"- {comp.type}: {comp.size or 'N/A'}" for comp in analysis.components],
            "",
            "Materials:",
            *[f"- {mat.name} {mat.grade or ''}" for mat in analysis.materials],
            "",
            "Standards:",
            *[f"- {std}" for std in analysis.standards + analysis.regional_codes],
            "",
            f"Notes: {analysis.notes}"
        ]
        return "\n".join(sections)


class SketchAgentNode:
    """LangGraph node wrapper for Sketch Agent."""
    
    def __init__(self, sketch_agent: SketchAgent):
        self.agent = sketch_agent
    
    async def __call__(self, state: AgentState) -> AgentState:
        """Process state through sketch agent."""
        try:
            metadata_list = state.get("sketch_metadata", [])
            images = state.get("images", [])
            context = state.get("project_context")
            
            if not images:
                state["error"] = "No images found"
                state["next_agent"] = END
                return state
            
            analysis_results = await self.agent.process_multiple_sketches(
                images, metadata_list, context
            )
            
            state["analysis_results"] = analysis_results
            state["extracted_data"] = self._aggregate_analysis(analysis_results)
            state["embeddings"] = [self.agent.to_embeddings_input(r) for r in analysis_results]
            
            avg_conf = sum(r.confidence_score for r in analysis_results) / len(analysis_results)
            state["messages"].append(
                AIMessage(
                    content=f"✅ Analyzed {len(analysis_results)} sketch(es) using {self.agent.provider}. "
                           f"Average confidence: {avg_conf:.1f}%"
                )
            )
            
            state["next_agent"] = "vector_store_agent"
            return state
            
        except Exception as e:
            state["error"] = f"Sketch Agent Error: {str(e)}"
            state["next_agent"] = END
            return state
    
    def _aggregate_analysis(self, results: List[SketchAnalysisOutput]) -> dict:
        """Aggregate analysis results."""
        if not results:
            return {}
        
        return {
            "total_sketches": len(results),
            "document_types": list(set(r.document_type.value for r in results)),
            "confidence_avg": sum(r.confidence_score for r in results) / len(results),
            "total_processing_time": sum(r.processing_time for r in results),
            "detailed_results": [r.model_dump() for r in results]
        }


def create_sketch_agent_graph() -> StateGraph:
    """Create LangGraph workflow for sketch processing."""
    sketch_agent = SketchAgent()
    sketch_node = SketchAgentNode(sketch_agent)
    
    workflow = StateGraph(AgentState)
    workflow.add_node("sketch_analysis", sketch_node)
    workflow.set_entry_point("sketch_analysis")
    
    def route_next(state: AgentState) -> str:
        return state.get("next_agent", END)
    
    workflow.add_conditional_edges("sketch_analysis", route_next)
    return workflow.compile()
