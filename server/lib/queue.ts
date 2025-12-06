import Redis from 'ioredis';

let publisher: Redis | null = null;
let workerConnection: Redis | null = null;
let isPublisherConnected = false;
let isWorkerConnected = false;

function getRedisConfig() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true,
    connectTimeout: 5000,
  };
}

function createConnection(name: string): Redis {
  const connection = new Redis(getRedisConfig());
  
  connection.on('connect', () => {
    console.log(`Redis ${name} connected`);
  });
  
  connection.on('error', (err) => {
    console.warn(`Redis ${name} error:`, err.message);
  });
  
  connection.on('close', () => {
    console.log(`Redis ${name} connection closed`);
  });
  
  return connection;
}

export async function initializeQueue(): Promise<boolean> {
  if (isPublisherConnected && publisher) {
    return true;
  }

  try {
    publisher = createConnection('publisher');
    await publisher.connect();
    isPublisherConnected = true;
    
    workerConnection = createConnection('worker');
    await workerConnection.connect();
    isWorkerConnected = true;
    
    return true;
  } catch (error: any) {
    console.warn('Redis not available, event queue disabled:', error.message);
    publisher = null;
    workerConnection = null;
    isPublisherConnected = false;
    isWorkerConnected = false;
    return false;
  }
}

export function isQueueAvailable(): boolean {
  return isPublisherConnected && publisher !== null;
}

export async function publishEvent(eventType: string, payload: any): Promise<boolean> {
  if (!isPublisherConnected || !publisher) {
    return false;
  }

  try {
    const message = JSON.stringify({
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
      id: generateEventId(),
    });
    
    await publisher.publish(eventType, message);
    return true;
  } catch (error: any) {
    console.error(`Failed to publish event ${eventType}:`, error.message);
    return false;
  }
}

export async function pushToQueue(queueName: string, payload: any): Promise<boolean> {
  if (!isPublisherConnected || !publisher) {
    return false;
  }

  try {
    const message = JSON.stringify({
      payload,
      timestamp: new Date().toISOString(),
      id: generateEventId(),
    });
    
    await publisher.lpush(queueName, message);
    return true;
  } catch (error: any) {
    console.error(`Failed to push to queue ${queueName}:`, error.message);
    return false;
  }
}

export function subscribeToEvent(eventType: string, handler: (payload: any) => void): (() => void) | null {
  if (!process.env.REDIS_HOST) {
    return null;
  }

  try {
    const subscriber = createConnection(`subscriber-${eventType}`);
    
    subscriber.subscribe(eventType, (err, count) => {
      if (err) {
        console.error(`Failed to subscribe to ${eventType}:`, err.message);
        return;
      }
      console.log(`Subscribed to ${eventType} (${count} total subscriptions)`);
    });
    
    subscriber.on('message', (channel, message) => {
      try {
        const parsed = JSON.parse(message);
        handler(parsed.payload || parsed);
      } catch (error: any) {
        console.error(`Error processing message from ${channel}:`, error.message);
      }
    });

    return () => {
      subscriber.unsubscribe(eventType);
      subscriber.disconnect();
    };
  } catch (error: any) {
    console.error(`Failed to create subscriber for ${eventType}:`, error.message);
    return null;
  }
}

export async function processQueue(
  queueName: string, 
  handler: (payload: any) => Promise<void>,
  options: { timeout?: number } = {}
): Promise<void> {
  if (!isWorkerConnected || !workerConnection) {
    return;
  }

  const timeout = options.timeout || 5;
  
  try {
    const result = await workerConnection.brpop(queueName, timeout);
    
    if (result) {
      const [, message] = result;
      const parsed = JSON.parse(message);
      await handler(parsed.payload || parsed);
    }
  } catch (error: any) {
    console.error(`Error processing queue ${queueName}:`, error.message);
  }
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function closeQueue(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
    isPublisherConnected = false;
  }
  if (workerConnection) {
    await workerConnection.quit();
    workerConnection = null;
    isWorkerConnected = false;
  }
}

export const EVENTS = {
  INTAKE_COMPLETE: 'workflow:intake:complete',
  ANALYSIS_START: 'workflow:analysis:start',
  ANALYSIS_COMPLETE: 'workflow:analysis:complete',
  DECISION_START: 'workflow:decision:start',
  DECISION_COMPLETE: 'workflow:decision:complete',
  GENERATION_START: 'workflow:generation:start',
  GENERATION_COMPLETE: 'workflow:generation:complete',
  REVIEW_START: 'workflow:review:start',
  REVIEW_COMPLETE: 'workflow:review:complete',
  WORKFLOW_ERROR: 'workflow:error',
} as const;

export const QUEUES = {
  BID_GENERATION: 'queue:bid:generation',
  DOCUMENT_PROCESSING: 'queue:document:processing',
  ANALYSIS: 'queue:analysis',
  NOTIFICATIONS: 'queue:notifications',
} as const;
