"""
BidForge AI - Vector Store Service
Integration with pgvector for RAG system
"""

import os
from typing import List, Dict, Any, Optional
from datetime import datetime

from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import PGVector
from langchain_core.documents import Document

from agents.types import SketchAnalysisOutput, RAGDocument


class SketchVectorStore:
    """
    Vector store for sketch analysis results.
    Uses pgvector for efficient similarity search.
    """
    
    def __init__(
        self,
        connection_string: Optional[str] = None,
        embedding_model: str = "text-embedding-3-small"
    ):
        """
        Initialize vector store.
        
        Args:
            connection_string: PostgreSQL connection string
            embedding_model: OpenAI embedding model name
        """
        self.connection_string = connection_string or os.getenv(
            "DATABASE_URL",
            "postgresql://localhost:5432/bidforge"
        )
        
        self.embeddings = OpenAIEmbeddings(model=embedding_model)
        self.vector_store = None
        self.collection_name = "sketch_vectors"
    
    async def initialize(self):
        """Initialize vector store connection."""
        self.vector_store = PGVector(
            connection_string=self.connection_string,
            embedding_function=self.embeddings,
            collection_name=self.collection_name
        )
    
    async def add_sketch_analysis(
        self,
        analysis: SketchAnalysisOutput
    ) -> List[str]:
        """
        Add sketch analysis to vector store.
        
        Args:
            analysis: Sketch analysis output
        
        Returns:
            List of vector IDs
        """
        documents = self._create_documents(analysis)
        
        # Add to vector store
        ids = await self.vector_store.aadd_documents(documents)
        
        return ids
    
    def _create_documents(
        self,
        analysis: SketchAnalysisOutput
    ) -> List[Document]:
        """
        Convert analysis to vector store documents.
        
        Args:
            analysis: Analysis output
        
        Returns:
            List of LangChain documents
        """
        documents = []
        base_metadata = {
            "sketch_id": analysis.sketch_id,
            "document_type": analysis.document_type.value,
            "project_phase": analysis.project_phase.value,
            "confidence_score": analysis.confidence_score,
            "analyzed_at": analysis.analyzed_at.isoformat(),
            "source_type": "sketch_analysis"
        }
        
        # Specifications documents
        for idx, spec in enumerate(analysis.specifications):
            doc = Document(
                page_content=spec,
                metadata={
                    **base_metadata,
                    "content_type": "specification",
                    "index": idx
                }
            )
            documents.append(doc)
        
        # Materials documents
        for idx, mat in enumerate(analysis.materials):
            content = f"""Material: {mat.name}
Grade: {mat.grade or 'N/A'}
Specification: {mat.specification or 'N/A'}
Quantity: {mat.quantity or 0} {mat.unit or ''}
Standard: {mat.standard or 'N/A'}
"""
            doc = Document(
                page_content=content,
                metadata={
                    **base_metadata,
                    "content_type": "material",
                    "material_name": mat.name,
                    "material_grade": mat.grade,
                    "index": idx
                }
            )
            documents.append(doc)
        
        # Components documents
        for idx, comp in enumerate(analysis.components):
            content = f"""Component Type: {comp.type}
Size: {comp.size or 'N/A'}
Count: {comp.count or 0}
Location: {comp.location or 'N/A'}
Specification: {comp.specification or 'N/A'}
"""
            doc = Document(
                page_content=content,
                metadata={
                    **base_metadata,
                    "content_type": "component",
                    "component_type": comp.type,
                    "index": idx
                }
            )
            documents.append(doc)
        
        # Standards document (combined)
        if analysis.standards or analysis.regional_codes:
            all_standards = analysis.standards + analysis.regional_codes
            content = "Applicable Standards and Codes:\n" + "\n".join(
                f"- {std}" for std in all_standards
            )
            doc = Document(
                page_content=content,
                metadata={
                    **base_metadata,
                    "content_type": "standards",
                    "standards_count": len(all_standards)
                }
            )
            documents.append(doc)
        
        # Summary document
        summary = f"""Construction Document Analysis Summary
Document Type: {analysis.document_type.value}
Project Phase: {analysis.project_phase.value}
Confidence Score: {analysis.confidence_score}%

Key Findings:
- {len(analysis.materials)} materials identified
- {len(analysis.components)} components catalogued
- {len(analysis.specifications)} specifications extracted
- {len(analysis.standards)} standards referenced

Notes: {analysis.notes}
"""
        doc = Document(
            page_content=summary,
            metadata={
                **base_metadata,
                "content_type": "summary"
            }
        )
        documents.append(doc)
        
        return documents
    
    async def search_similar(
        self,
        query: str,
        limit: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[Document]:
        """
        Search for similar documents.
        
        Args:
            query: Search query
            limit: Number of results
            filter_metadata: Optional metadata filters
        
        Returns:
            List of similar documents
        """
        results = await self.vector_store.asimilarity_search(
            query=query,
            k=limit,
            filter=filter_metadata
        )
        
        return results
    
    async def search_by_sketch_id(
        self,
        sketch_id: str
    ) -> List[Document]:
        """
        Retrieve all documents for a specific sketch.
        
        Args:
            sketch_id: Sketch ID
        
        Returns:
            All documents for the sketch
        """
        return await self.search_similar(
            query="",
            limit=100,
            filter_metadata={"sketch_id": sketch_id}
        )
    
    async def delete_sketch_documents(self, sketch_id: str) -> bool:
        """Delete all documents for a sketch."""
        try:
            # Implementation depends on vector store capabilities
            # This is a placeholder
            return True
        except Exception:
            return False
