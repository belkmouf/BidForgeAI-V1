import { BaseAgent, AgentInput, AgentOutput, AgentContext } from './base-agent';
import { DocumentInfoType } from './state';
import { db } from '../db';
import { documents } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class IntakeAgent extends BaseAgent {
  name = 'intake';
  description = 'Processes and validates incoming documents for the bid workflow';

  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    return this.wrapExecution(async () => {
      const { projectId } = context;

      this.log(`Processing documents for project: ${projectId}`);

      const projectDocuments = await db
        .select()
        .from(documents)
        .where(eq(documents.projectId, projectId));

      if (projectDocuments.length === 0) {
        this.log('No documents found for project');
        return {
          success: false,
          error: 'No documents found for this project. Please upload RFQ documents first.',
        };
      }

      const documentInfos: DocumentInfoType[] = projectDocuments.map(doc => ({
        id: doc.id,
        name: doc.filename,
        type: doc.filename.split('.').pop() || 'unknown',
        content: doc.content || undefined,
        processedAt: doc.isProcessed ? new Date() : undefined,
      }));

      const unprocessedCount = documentInfos.filter(d => !d.processedAt).length;
      if (unprocessedCount > 0) {
        this.log(`Found ${unprocessedCount} unprocessed documents`);
      }

      this.log(`Loaded ${documentInfos.length} documents`);

      return {
        success: true,
        data: {
          documents: documentInfos,
          logs: [`Loaded ${documentInfos.length} documents from project ${projectId}`],
        },
      };
    }, 'document intake');
  }
}

export const intakeAgent = new IntakeAgent();
