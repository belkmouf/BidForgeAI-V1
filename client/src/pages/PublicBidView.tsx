import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { getPublicBid } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function PublicBidView() {
  const [, params] = useRoute('/share/:token');
  const token = params?.token || '';
  
  const [bidHtml, setBidHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBid() {
      if (!token) {
        setError('Invalid share link');
        setIsLoading(false);
        return;
      }
      
      try {
        const data = await getPublicBid(token);
        setBidHtml(data.bid.content);
      } catch (err: any) {
        setError(err.message || 'Failed to load bid');
      } finally {
        setIsLoading(false);
      }
    }
    loadBid();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-gray-600">Loading bid proposal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Unable to Load Bid</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            This link may have expired or the bid may no longer be available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      srcDoc={bidHtml}
      className="w-full h-screen border-none"
      title="Bid Proposal"
      data-testid="iframe-public-bid"
    />
  );
}
