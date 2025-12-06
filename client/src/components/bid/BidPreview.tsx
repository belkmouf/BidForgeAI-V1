import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Printer, Maximize2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface BidPreviewProps {
  html: string;
  projectName: string;
  onExportPDF?: () => void;
}

export function BidPreview({ html, projectName, onExportPDF }: BidPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleDownloadHTML = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '-')}-bid-proposal.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full" data-testid="bid-preview-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Bid Preview</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            data-testid="button-print-bid"
          >
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadHTML}
            data-testid="button-download-bid"
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
          <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-fullscreen-bid"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  {projectName} - Bid Proposal
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFullscreen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-auto">
                <iframe
                  srcDoc={html}
                  className="w-full h-full border rounded-lg"
                  title="Bid Preview"
                  data-testid="iframe-bid-preview-fullscreen"
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <iframe
          srcDoc={html}
          className="w-full h-full border rounded-lg bg-white"
          title="Bid Preview"
          data-testid="iframe-bid-preview"
        />
      </CardContent>
    </Card>
  );
}

export default BidPreview;
