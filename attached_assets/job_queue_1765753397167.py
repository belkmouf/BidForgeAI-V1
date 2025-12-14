"""
BidForge AI - Job Queue Service
Background job management for async processing
"""

from typing import Dict, Optional
from datetime import datetime
import threading

from agents.types import ProcessingJob, JobStatus


class JobQueue:
    """
    Simple in-memory job queue.
    For production, use Redis or a proper queue system.
    """
    
    def __init__(self):
        """Initialize job queue."""
        self.jobs: Dict[str, ProcessingJob] = {}
        self.lock = threading.Lock()
    
    def create_job(
        self,
        job_id: str,
        job_type: str,
        input_data: Dict,
        total_steps: Optional[int] = None
    ) -> ProcessingJob:
        """Create a new job."""
        with self.lock:
            job = ProcessingJob(
                job_id=job_id,
                status=JobStatus.PENDING,
                job_type=job_type,
                input_data=input_data,
                total_steps=total_steps
            )
            self.jobs[job_id] = job
            return job
    
    def get_job(self, job_id: str) -> Optional[ProcessingJob]:
        """Get job by ID."""
        return self.jobs.get(job_id)
    
    def update_job(
        self,
        job_id: str,
        status: JobStatus,
        progress_percent: Optional[int] = None,
        current_step: Optional[str] = None
    ):
        """Update job status."""
        with self.lock:
            if job_id in self.jobs:
                job = self.jobs[job_id]
                job.status = status
                job.updated_at = datetime.now()
                
                if progress_percent is not None:
                    job.progress_percent = progress_percent
                
                if current_step:
                    job.current_step = current_step
    
    def complete_job(self, job_id: str, result: Dict):
        """Mark job as complete."""
        with self.lock:
            if job_id in self.jobs:
                job = self.jobs[job_id]
                job.status = JobStatus.COMPLETED
                job.result = result
                job.completed_at = datetime.now()
                job.progress_percent = 100
                
                # Calculate processing time
                job.processing_time = (
                    job.completed_at - job.created_at
                ).total_seconds()
    
    def fail_job(self, job_id: str, error: str):
        """Mark job as failed."""
        with self.lock:
            if job_id in self.jobs:
                job = self.jobs[job_id]
                job.status = JobStatus.FAILED
                job.error_message = error
                job.updated_at = datetime.now()
    
    def cancel_job(self, job_id: str):
        """Cancel a job."""
        with self.lock:
            if job_id in self.jobs:
                job = self.jobs[job_id]
                job.status = JobStatus.CANCELLED
                job.updated_at = datetime.now()
    
    def delete_job(self, job_id: str):
        """Delete a job."""
        with self.lock:
            if job_id in self.jobs:
                del self.jobs[job_id]
    
    def list_jobs(self, status: Optional[JobStatus] = None) -> list:
        """List all jobs, optionally filtered by status."""
        if status:
            return [j for j in self.jobs.values() if j.status == status]
        return list(self.jobs.values())
