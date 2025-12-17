import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth';
import { 
  MessageSquare, 
  Send, 
  CheckCircle, 
  Trash2,
  Reply,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: number;
  projectId: string;
  userId: number;
  content: string;
  parentId: number | null;
  isResolved: boolean;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
  userEmail: string;
}

interface ProjectCommentsProps {
  projectId: string;
}

export function ProjectComments({ projectId }: ProjectCommentsProps) {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { accessToken: token, user } = useAuthStore();

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ['comments', projectId, showResolved],
    queryFn: async () => {
      const res = await fetch(
        `/api/team/projects/${projectId}/comments?includeResolved=${showResolved}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json();
    },
    enabled: !!token,
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: number }) => {
      const res = await fetch(`/api/team/projects/${projectId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, parentId }),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', projectId] });
      setNewComment('');
      setReplyingTo(null);
      toast({ title: 'Comment added' });
    },
    onError: () => {
      toast({ title: 'Failed to add comment', variant: 'destructive' });
    },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: async ({ commentId, isResolved }: { commentId: number; isResolved: boolean }) => {
      const res = await fetch(`/api/team/projects/${projectId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isResolved }),
      });
      if (!res.ok) throw new Error('Failed to update comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', projectId] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const res = await fetch(`/api/team/projects/${projectId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', projectId] });
      toast({ title: 'Comment deleted' });
    },
  });

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate({
      content: newComment,
      parentId: replyingTo || undefined,
    });
  };

  const parentComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId: number) => comments.filter(c => c.parentId === parentId);

  return (
    <Card className="border-white/10 bg-[#1a1a1a]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Comments
            <Badge variant="secondary" className="ml-1">
              {comments.filter(c => !c.isResolved).length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Checkbox
              id="showResolved"
              checked={showResolved}
              onCheckedChange={(checked) => setShowResolved(checked as boolean)}
            />
            <label htmlFor="showResolved" className="text-sm text-gray-400">
              Show resolved
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-[250px]">
          {isLoading ? (
            <div className="text-center text-gray-500 py-4">Loading...</div>
          ) : parentComments.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No comments yet</p>
              <p className="text-xs mt-1">Be the first to add a comment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {parentComments.map(comment => (
                <div key={comment.id} className="space-y-2">
                  <CommentItem
                    comment={comment}
                    user={user}
                    onReply={() => setReplyingTo(comment.id)}
                    onResolve={(isResolved) => 
                      resolveCommentMutation.mutate({ commentId: comment.id, isResolved })
                    }
                    onDelete={() => deleteCommentMutation.mutate(comment.id)}
                    getInitials={getInitials}
                  />
                  {getReplies(comment.id).map(reply => (
                    <div key={reply.id} className="ml-8">
                      <CommentItem
                        comment={reply}
                        user={user}
                        onReply={() => setReplyingTo(comment.id)}
                        onResolve={(isResolved) => 
                          resolveCommentMutation.mutate({ commentId: reply.id, isResolved })
                        }
                        onDelete={() => deleteCommentMutation.mutate(reply.id)}
                        getInitials={getInitials}
                        isReply
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="pt-3 border-t border-white/10">
          {replyingTo && (
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
              <Reply className="h-3 w-3" />
              Replying to comment
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1"
                onClick={() => setReplyingTo(null)}
              >
                Cancel
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[60px] resize-none bg-white/5 border-white/10"
              data-testid="input-comment"
            />
            <Button
              onClick={handleSubmit}
              disabled={!newComment.trim() || addCommentMutation.isPending}
              className="self-end bg-primary hover:bg-primary/90"
              data-testid="button-add-comment"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CommentItemProps {
  comment: Comment;
  user: { id: number; email: string; name: string | null; role: string } | null;
  onReply: () => void;
  onResolve: (isResolved: boolean) => void;
  onDelete: () => void;
  getInitials: (name: string | null, email: string) => string;
  isReply?: boolean;
}

function CommentItem({ 
  comment, 
  user, 
  onReply, 
  onResolve, 
  onDelete, 
  getInitials,
  isReply 
}: CommentItemProps) {
  const isOwner = user?.id === comment.userId;

  return (
    <div
      className={`p-3 rounded-lg ${comment.isResolved ? 'bg-green-500/5 border border-green-500/20' : 'bg-white/5'}`}
      data-testid={`comment-${comment.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {getInitials(comment.userName, comment.userEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {comment.userName || comment.userEmail}
              </span>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </span>
              {comment.isResolved && (
                <Badge variant="outline" className="text-green-500 border-green-500/30 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Resolved
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">
              {comment.content}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isReply && (
              <DropdownMenuItem onClick={onReply}>
                <Reply className="h-4 w-4 mr-2" />
                Reply
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onResolve(!comment.isResolved)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {comment.isResolved ? 'Unresolve' : 'Mark as Resolved'}
            </DropdownMenuItem>
            {isOwner && (
              <DropdownMenuItem className="text-red-500" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default ProjectComments;
