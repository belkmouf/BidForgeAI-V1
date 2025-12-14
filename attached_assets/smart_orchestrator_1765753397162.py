"""
BidForge AI - Smart Multi-Agent Orchestrator
Conditionally triggers agents based on content type
"""

from typing import Dict, Any, List, Optional
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage

from .sketch_agent import SketchAgentNode, SketchAgent
from .types import AgentState


class BidForgeOrchestrator:
    """
    Smart orchestrator that conditionally routes through agents.
    
    Workflow:
    1. Classify input (text-only vs. has-sketches)
    2. Route accordingly:
       - Text-only: Skip sketch agent → Direct to analysis
       - Has-sketches: Sketch agent → Vector store → Analysis
    3. Continue through decision → generation → review
    """
    
    def __init__(self):
        self.sketch_agent = SketchAgent()
        self.workflow = self._build_workflow()
    
    def _build_workflow(self) -> StateGraph:
        """Build conditional multi-agent workflow."""
        workflow = StateGraph(AgentState)
        
        # Add all agent nodes
        workflow.add_node("input_classifier", self._input_classifier_node)
        workflow.add_node("sketch_analysis", SketchAgentNode(self.sketch_agent))
        workflow.add_node("vector_store_agent", self._vector_store_node)
        workflow.add_node("analysis_agent", self._analysis_node)
        workflow.add_node("decision_agent", self._decision_node)
        workflow.add_node("generation_agent", self._generation_node)
        workflow.add_node("review_agent", self._review_node)
        
        # Set entry point
        workflow.set_entry_point("input_classifier")
        
        # Conditional routing from classifier
        workflow.add_conditional_edges(
            "input_classifier",
            self._route_from_classifier,
            {
                "sketch_analysis": "sketch_analysis",  # Has sketches
                "analysis_agent": "analysis_agent"      # Text-only
            }
        )
        
        # Sketch path
        workflow.add_edge("sketch_analysis", "vector_store_agent")
        workflow.add_edge("vector_store_agent", "analysis_agent")
        
        # Common path (all RFPs go through these)
        workflow.add_edge("analysis_agent", "decision_agent")
        
        # Conditional routing from decision
        workflow.add_conditional_edges(
            "decision_agent",
            self._route_decision,
            {
                "generate": "generation_agent",
                "reject": END
            }
        )
        
        workflow.add_edge("generation_agent", "review_agent")
        workflow.add_edge("review_agent", END)
        
        return workflow.compile()
    
    async def _input_classifier_node(self, state: AgentState) -> AgentState:
        """
        Classify input to determine if sketch analysis is needed.
        
        Checks:
        - Are there images in state?
        - Are there sketch_metadata entries?
        - Is this explicitly a sketch upload?
        """
        has_sketches = False
        sketch_count = 0
        
        # Check for images
        images = state.get("images", [])
        if images and len(images) > 0:
            has_sketches = True
            sketch_count = len(images)
        
        # Check for sketch metadata
        sketch_metadata = state.get("sketch_metadata", [])
        if sketch_metadata and len(sketch_metadata) > 0:
            has_sketches = True
            sketch_count = max(sketch_count, len(sketch_metadata))
        
        # Check explicit flag
        if state.get("requires_sketch_analysis", False):
            has_sketches = True
        
        # Update state
        state["has_sketches"] = has_sketches
        state["sketch_count"] = sketch_count
        
        if has_sketches:
            state["messages"].append(
                AIMessage(content=f"📊 Detected {sketch_count} sketch(es). Routing to sketch analysis agent.")
            )
            state["next_agent"] = "sketch_analysis"
        else:
            state["messages"].append(
                AIMessage(content="📄 Text-only RFP detected. Skipping sketch analysis.")
            )
            state["next_agent"] = "analysis_agent"
        
        return state
    
    def _route_from_classifier(self, state: AgentState) -> str:
        """Route based on classification."""
        if state.get("has_sketches", False):
            return "sketch_analysis"
        return "analysis_agent"
    
    async def _vector_store_node(self, state: AgentState) -> AgentState:
        """Store embeddings in pgvector."""
        # Implementation: Store extracted data in vector DB
        state["messages"].append(
            HumanMessage(content="✅ Sketch data stored in vector database")
        )
        return state
    
    async def _analysis_node(self, state: AgentState) -> AgentState:
        """Deep RFP analysis agent."""
        has_sketch_data = state.get("has_sketches", False)
        
        if has_sketch_data:
            state["messages"].append(
                HumanMessage(content="🔍 Analyzing RFP with sketch data integrated")
            )
        else:
            state["messages"].append(
                HumanMessage(content="🔍 Analyzing text-only RFP")
            )
        
        # Analysis logic here...
        state["analysis_complete"] = True
        return state
    
    async def _decision_node(self, state: AgentState) -> AgentState:
        """Go/No-Go decision agent."""
        # Decision logic here...
        state["decision"] = "generate"  # or "reject"
        state["messages"].append(
            HumanMessage(content="✅ Decision: Proceed with bid")
        )
        return state
    
    async def _generation_agent(self, state: AgentState) -> AgentState:
        """RAG-powered response generation."""
        has_sketch_data = state.get("has_sketches", False)
        
        if has_sketch_data:
            # Use sketch data in RAG context
            state["messages"].append(
                HumanMessage(content="✨ Generating bid response using sketch analysis + RFP requirements")
            )
        else:
            state["messages"].append(
                HumanMessage(content="✨ Generating bid response from RFP text")
            )
        
        return state
    
    async def _review_agent(self, state: AgentState) -> AgentState:
        """Quality assurance and compliance review."""
        state["messages"].append(
            HumanMessage(content="✅ Quality review complete")
        )
        return state
    
    def _route_decision(self, state: AgentState) -> str:
        """Route based on decision agent output."""
        decision = state.get("decision", "reject")
        return decision
    
    async def process_rfp(
        self,
        rfp_text: str,
        sketches: Optional[List[Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Main entry point for processing RFP.
        
        Args:
            rfp_text: RFP document text
            sketches: Optional list of sketch images
            metadata: Optional metadata
        
        Returns:
            Complete workflow result
        """
        # Initialize state
        initial_state: AgentState = {
            "messages": [
                HumanMessage(content=f"Process RFP: {metadata.get('rfp_id', 'unknown')}")
            ],
            "rfp_text": rfp_text,
            "images": sketches or [],
            "sketch_metadata": metadata.get("sketches", []) if metadata else [],
            "project_context": metadata.get("context") if metadata else None,
            "analysis_results": [],
            "extracted_data": {},
            "embeddings": [],
            "next_agent": "input_classifier",
            "error": None,
            "requires_sketch_analysis": bool(sketches),  # Explicit flag
            "retry_count": 0
        }
        
        # Run workflow
        final_state = await self.workflow.ainvoke(initial_state)
        
        return {
            "success": final_state.get("error") is None,
            "has_sketches": final_state.get("has_sketches", False),
            "sketch_count": final_state.get("sketch_count", 0),
            "analysis_results": final_state.get("analysis_results", []),
            "extracted_data": final_state.get("extracted_data", {}),
            "decision": final_state.get("decision", "unknown"),
            "final_response": final_state.get("final_response"),
            "messages": final_state.get("messages", []),
            "error": final_state.get("error")
        }


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def has_visual_content(files: List[Any]) -> bool:
    """
    Check if uploaded files contain visual content.
    
    Args:
        files: List of uploaded files
    
    Returns:
        True if any file is an image or drawing PDF
    """
    visual_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.pdf'}
    
    for file in files:
        filename = getattr(file, 'filename', str(file)).lower()
        if any(filename.endswith(ext) for ext in visual_extensions):
            return True
    
    return False


def extract_sketches_from_files(files: List[Any]) -> tuple[List[Any], List[Any]]:
    """
    Separate sketch files from text documents.
    
    Args:
        files: List of uploaded files
    
    Returns:
        Tuple of (sketch_files, text_files)
    """
    sketch_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'}
    pdf_with_drawings = []  # PDFs need content inspection
    
    sketches = []
    texts = []
    
    for file in files:
        filename = getattr(file, 'filename', str(file)).lower()
        
        if any(filename.endswith(ext) for ext in sketch_extensions):
            sketches.append(file)
        elif filename.endswith('.pdf'):
            # TODO: Inspect PDF content to determine if it's a drawing or text
            # For now, treat as potential sketch
            pdf_with_drawings.append(file)
        else:
            texts.append(file)
    
    # Add PDFs to sketches for now (can be refined)
    sketches.extend(pdf_with_drawings)
    
    return sketches, texts
