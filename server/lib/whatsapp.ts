import WhatsApp from 'whatsapp';

const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
const accessToken = process.env.CLOUD_API_ACCESS_TOKEN;
const webhookVerifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
const apiVersion = process.env.CLOUD_API_VERSION || 'v18.0';

let waClient: any = null;

export function initWhatsApp() {
  if (!phoneNumberId || !accessToken) {
    console.log('WhatsApp credentials not configured. Set WA_PHONE_NUMBER_ID and CLOUD_API_ACCESS_TOKEN.');
    return null;
  }

  try {
    waClient = new WhatsApp(Number(phoneNumberId));
    console.log('WhatsApp client initialized');
    return waClient;
  } catch (error) {
    console.error('Failed to initialize WhatsApp client:', error);
    return null;
  }
}

export function getWhatsAppClient() {
  return waClient;
}

export function getWebhookVerifyToken() {
  return webhookVerifyToken || 'bidforge_webhook_token';
}

export async function sendTextMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!waClient) {
    return { success: false, error: 'WhatsApp client not initialized' };
  }

  try {
    const cleanNumber = to.replace(/\D/g, '');
    const response = await waClient.messages.text({ body: message }, cleanNumber);
    return { success: true, messageId: response?.messages?.[0]?.id };
  } catch (error: any) {
    console.error('Failed to send WhatsApp message:', error);
    return { success: false, error: error.message || 'Failed to send message' };
  }
}

export async function sendDocument(
  to: string, 
  documentUrl: string, 
  filename: string,
  caption?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!waClient) {
    return { success: false, error: 'WhatsApp client not initialized' };
  }

  try {
    const cleanNumber = to.replace(/\D/g, '');
    const response = await waClient.messages.document(
      { 
        link: documentUrl,
        filename: filename,
        caption: caption || `Document: ${filename}`
      }, 
      cleanNumber
    );
    return { success: true, messageId: response?.messages?.[0]?.id };
  } catch (error: any) {
    console.error('Failed to send WhatsApp document:', error);
    return { success: false, error: error.message || 'Failed to send document' };
  }
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = 'en_US',
  components?: any[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!waClient) {
    return { success: false, error: 'WhatsApp client not initialized' };
  }

  try {
    const cleanNumber = to.replace(/\D/g, '');
    const templateData: any = {
      name: templateName,
      language: { code: languageCode }
    };
    
    if (components) {
      templateData.components = components;
    }

    const response = await waClient.messages.template(templateData, cleanNumber);
    return { success: true, messageId: response?.messages?.[0]?.id };
  } catch (error: any) {
    console.error('Failed to send WhatsApp template:', error);
    return { success: false, error: error.message || 'Failed to send template' };
  }
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'location' | 'contacts';
  text?: { body: string };
  document?: { id: string; filename: string; mime_type: string };
  image?: { id: string; caption?: string };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export function parseWebhookPayload(payload: WhatsAppWebhookPayload): {
  messages: Array<WhatsAppMessage & { contactName?: string; contactNumber?: string }>;
  statuses: Array<{ id: string; status: string; timestamp: string; recipientId: string }>;
} {
  const messages: Array<WhatsAppMessage & { contactName?: string; contactNumber?: string }> = [];
  const statuses: Array<{ id: string; status: string; timestamp: string; recipientId: string }> = [];

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      
      if (value.messages) {
        for (const msg of value.messages) {
          const contact = value.contacts?.find(c => c.wa_id === msg.from);
          messages.push({
            ...msg,
            contactName: contact?.profile?.name,
            contactNumber: msg.from
          });
        }
      }

      if (value.statuses) {
        for (const status of value.statuses) {
          statuses.push({
            id: status.id,
            status: status.status,
            timestamp: status.timestamp,
            recipientId: status.recipient_id
          });
        }
      }
    }
  }

  return { messages, statuses };
}

export function isWhatsAppConfigured(): boolean {
  return !!(phoneNumberId && accessToken);
}
