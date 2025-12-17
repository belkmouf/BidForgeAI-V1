import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/lib/auth';
import { 
  Activity, 
  UserPlus, 
  UserMinus, 
  MessageSquare, 
  FileText, 
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: number;
  projectId: string;
  userId: number;
  activityType: string;
  description: string;
  metadata: Record<string, any>;
  createdAt: string;
  userName: string | null;
  userEmail: string;
}

interface ActivityFeedProps {
  projectId: string;
  limit?: number;
}

const activityIcons: Record<string, typeof Activity> = {
  member_added: UserPlus,
  member_removed: UserMinus,
  comment_added: MessageSquare,
  document_uploaded: FileText,
  bid_generated: Sparkles,
  analysis_completed: CheckCircle,
  status_changed: AlertTriangle,
  default: Activity,
};

const activityColors: Record<string, string> = {
  member_added: 'text-green-500 bg-green-500/10',
  member_removed: 'text-red-500 bg-red-500/10',
  comment_added: 'text-blue-500 bg-blue-500/10',
  document_uploaded: 'text-purple-500 bg-purple-500/10',
  bid_generated: 'text-amber-500 bg-amber-500/10',
  analysis_completed: 'text-emerald-500 bg-emerald-500/10',
  status_changed: 'text-orange-500 bg-orange-500/10',
  default: 'text-gray-500 bg-gray-500/10',
};

export function ActivityFeed({ projectId, limit = 20 }: ActivityFeedProps) {
  const { accessToken: token } = useAuthStore();

  const { data: activities = [], isLoading } = useQuery<ActivityItem[]>({
    queryKey: ['activity', projectId, limit],
    queryFn: async () => {
      const res = await fetch(
        `/api/team/projects/${projectId}/activity?limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 30000,
  });

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getIcon = (activityType: string) => {
    return activityIcons[activityType] || activityIcons.default;
  };

  const getColor = (activityType: string) => {
    return activityColors[activityType] || activityColors.default;
  };

  return (
    <Card className="border-white/10 bg-[#1a1a1a]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="h-5 w-5 animate-spin text-gray-500" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No activity yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity, index) => {
                const Icon = getIcon(activity.activityType);
                const color = getColor(activity.activityType);
                
                return (
                  <div
                    key={activity.id}
                    className="flex gap-3"
                    data-testid={`activity-${activity.id}`}
                  >
                    <div className="relative">
                      <div className={`p-2 rounded-full ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {index < activities.length - 1 && (
                        <div className="absolute left-1/2 top-10 bottom-0 w-px bg-white/10 -translate-x-1/2 h-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                            {getInitials(activity.userName, activity.userEmail)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">
                          {activity.userName || activity.userEmail}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        {activity.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default ActivityFeed;
