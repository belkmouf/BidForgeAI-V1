const API_BASE = '/api/whatsapp';

export interface WhatsAppStatus {
  configured: boolean;
  message: string;
}

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    return { success: false, error: errorText || res.statusText };
  }
  return res.json();
}

export async function sendDocument(
  to: string, 
  documentUrl: string, 
  filename: string, 
  caption?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/send-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, documentUrl, filename, caption }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    return { success: false, error: errorText || res.statusText };
  }
  return res.json();
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode?: string,
  components?: any[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/send-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, templateName, languageCode, components }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    return { success: false, error: errorText || res.statusText };
  }
  return res.json();
}
