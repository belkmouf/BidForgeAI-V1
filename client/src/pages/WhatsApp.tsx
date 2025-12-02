import { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Send, FileText, Settings, CheckCircle, XCircle, Loader2, AlertCircle, Phone } from 'lucide-react';
import { getWhatsAppStatus, sendMessage, sendDocument } from '@/lib/whatsapp-api';
import { toast } from '@/hooks/use-toast';

export default function WhatsAppPage() {
  const [status, setStatus] = useState<{ configured: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [docPhoneNumber, setDocPhoneNumber] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docFilename, setDocFilename] = useState('');
  const [docCaption, setDocCaption] = useState('');
  const [sendingDoc, setSendingDoc] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      try {
        const result = await getWhatsAppStatus();
        setStatus(result);
      } catch (error) {
        console.error('Failed to check WhatsApp status:', error);
        setStatus({ configured: false, message: 'Failed to check status' });
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, []);

  const handleSendMessage = async () => {
    if (!phoneNumber || !message) {
      toast({
        title: "Missing Information",
        description: "Please enter both phone number and message.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const result = await sendMessage(phoneNumber, message);
      if (result.success) {
        toast({
          title: "Message Sent",
          description: "Your WhatsApp message was sent successfully.",
        });
        setMessage('');
      } else {
        toast({
          title: "Send Failed",
          description: result.error || "Failed to send message",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendDocument = async () => {
    if (!docPhoneNumber || !docUrl || !docFilename) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setSendingDoc(true);
    try {
      const result = await sendDocument(docPhoneNumber, docUrl, docFilename, docCaption);
      if (result.success) {
        toast({
          title: "Document Sent",
          description: "Your document was sent via WhatsApp.",
        });
        setDocUrl('');
        setDocFilename('');
        setDocCaption('');
      } else {
        toast({
          title: "Send Failed",
          description: result.error || "Failed to send document",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSendingDoc(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 ml-64 p-8 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-700">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold">WhatsApp Integration</h1>
                <p className="text-muted-foreground">Send messages and documents to clients via WhatsApp</p>
              </div>
            </div>
            {loading ? (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking...
              </Badge>
            ) : status?.configured ? (
              <Badge variant="default" className="gap-1 bg-green-600">
                <CheckCircle className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                Not Configured
              </Badge>
            )}
          </div>

          {!status?.configured && !loading && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-800 flex items-center gap-2 text-lg">
                  <AlertCircle className="h-5 w-5" />
                  Configuration Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-amber-700 text-sm mb-4">
                  To use WhatsApp messaging, you need to configure your Meta WhatsApp Business API credentials:
                </p>
                <div className="bg-white rounded-lg p-4 border border-amber-200 space-y-2 font-mono text-sm">
                  <div><span className="text-amber-600">WA_PHONE_NUMBER_ID=</span>your_phone_number_id</div>
                  <div><span className="text-amber-600">CLOUD_API_ACCESS_TOKEN=</span>your_access_token</div>
                  <div><span className="text-amber-600">WEBHOOK_VERIFY_TOKEN=</span>bidforge_webhook_token</div>
                  <div><span className="text-amber-600">WA_APP_SECRET=</span>your_app_secret (for webhook security)</div>
                </div>
                <p className="text-amber-700 text-sm mt-4">
                  Get these from the <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium">Meta Developer Console</a> → WhatsApp → Getting Started.
                </p>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="message" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="message" className="gap-2" data-testid="tab-message">
                <Send className="h-4 w-4" />
                Send Message
              </TabsTrigger>
              <TabsTrigger value="document" className="gap-2" data-testid="tab-document">
                <FileText className="h-4 w-4" />
                Send Document
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
                <Settings className="h-4 w-4" />
                Webhook Setup
              </TabsTrigger>
            </TabsList>

            <TabsContent value="message" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Send WhatsApp Message</CardTitle>
                  <CardDescription>
                    Send a text message to a client's WhatsApp number
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        placeholder="1234567890 (include country code, no + or spaces)"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="pl-10"
                        data-testid="input-phone"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Enter your message here..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="min-h-[120px]"
                      data-testid="input-message"
                    />
                  </div>

                  <Button 
                    onClick={handleSendMessage} 
                    disabled={sending || !status?.configured}
                    className="w-full gap-2"
                    data-testid="button-send-message"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Message
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="document" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Send Document via WhatsApp</CardTitle>
                  <CardDescription>
                    Share bid documents, proposals, or contracts with clients
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="doc-phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="doc-phone"
                        placeholder="1234567890 (include country code)"
                        value={docPhoneNumber}
                        onChange={(e) => setDocPhoneNumber(e.target.value)}
                        className="pl-10"
                        data-testid="input-doc-phone"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="doc-url">Document URL</Label>
                    <Input
                      id="doc-url"
                      placeholder="https://example.com/document.pdf"
                      value={docUrl}
                      onChange={(e) => setDocUrl(e.target.value)}
                      data-testid="input-doc-url"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="doc-filename">Filename</Label>
                    <Input
                      id="doc-filename"
                      placeholder="proposal.pdf"
                      value={docFilename}
                      onChange={(e) => setDocFilename(e.target.value)}
                      data-testid="input-doc-filename"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="doc-caption">Caption (optional)</Label>
                    <Input
                      id="doc-caption"
                      placeholder="Here's the proposal for your project"
                      value={docCaption}
                      onChange={(e) => setDocCaption(e.target.value)}
                      data-testid="input-doc-caption"
                    />
                  </div>

                  <Button 
                    onClick={handleSendDocument} 
                    disabled={sendingDoc || !status?.configured}
                    className="w-full gap-2"
                    data-testid="button-send-document"
                  >
                    {sendingDoc ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Send Document
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Webhook Configuration</CardTitle>
                  <CardDescription>
                    Set up your webhook in Meta Developer Console to receive messages
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Callback URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={`${window.location.origin}/api/whatsapp/webhook`}
                        readOnly
                        className="font-mono text-sm"
                        data-testid="input-webhook-url"
                      />
                      <Button 
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/api/whatsapp/webhook`);
                          toast({ title: "Copied", description: "Webhook URL copied to clipboard" });
                        }}
                        data-testid="button-copy-webhook"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Verify Token</Label>
                    <div className="flex gap-2">
                      <Input
                        value="bidforge_webhook_token"
                        readOnly
                        className="font-mono text-sm"
                        data-testid="input-verify-token"
                      />
                      <Button 
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText('bidforge_webhook_token');
                          toast({ title: "Copied", description: "Verify token copied to clipboard" });
                        }}
                        data-testid="button-copy-token"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="bg-muted rounded-lg p-4 space-y-3">
                    <h4 className="font-medium">Setup Instructions:</h4>
                    <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                      <li>Go to <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Meta Developer Console</a></li>
                      <li>Select your app → WhatsApp → Configuration</li>
                      <li>Under Webhooks, click "Edit"</li>
                      <li>Enter the Callback URL from above</li>
                      <li>Enter the Verify Token from above</li>
                      <li>Click "Verify and Save"</li>
                      <li>Subscribe to the "messages" field</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
