import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth";
import {
  Users,
  UserPlus,
  Crown,
  Edit,
  Eye,
  Trash2,
  Circle,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TeamMember {
  id: number;
  projectId: string;
  userId: number;
  role: string;
  addedAt: string;
  lastAccessedAt: string | null;
  userName: string | null;
  userEmail: string;
}

interface OnlineUser {
  id: number;
  userId: number;
  status: string;
  currentPage: string | null;
  lastActiveAt: string;
  userName: string | null;
  userEmail: string;
}

interface User {
  id: number;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
}

interface TeamPanelProps {
  projectId: string;
}

const roleIcons: Record<string, typeof Crown> = {
  owner: Crown,
  editor: Edit,
  viewer: Eye,
};

const roleColors: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  editor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  viewer: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export function TeamPanel({ projectId }: TeamPanelProps) {
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("viewer");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { accessToken: token } = useAuthStore();

  const { data: members = [], isLoading: loadingMembers } = useQuery<
    TeamMember[]
  >({
    queryKey: ["team-members", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/team/projects/${projectId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch team members");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: onlineUsers = [] } = useQuery<OnlineUser[]>({
    queryKey: ["presence", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/team/projects/${projectId}/presence`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch presence");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 30000,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/team/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: !!token && isAddMemberOpen,
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const res = await fetch(`/api/team/projects/${projectId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", projectId] });
      setIsAddMemberOpen(false);
      setSelectedUserId("");
      setSelectedRole("viewer");
      toast({ title: "Team member added successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: number;
      role: string;
    }) => {
      const res = await fetch(
        `/api/team/projects/${projectId}/members/${memberId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role }),
        },
      );
      if (!res.ok) throw new Error("Failed to update role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", projectId] });
      toast({ title: "Role updated" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: number) => {
      const res = await fetch(
        `/api/team/projects/${projectId}/members/${memberId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to remove member");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", projectId] });
      toast({ title: "Team member removed" });
    },
  });

  // Heartbeat for presence
  useEffect(() => {
    if (!token || !projectId) return;

    const updatePresence = async () => {
      try {
        await fetch("/api/team/presence", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            projectId,
            currentPage: window.location.pathname,
            status: "online",
          }),
        });
      } catch (error) {
        console.error("Failed to update presence:", error);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 60000);
    return () => clearInterval(interval);
  }, [token, projectId]);

  const onlineUserIds = new Set(onlineUsers.map((u) => u.userId));
  const availableUsers = allUsers.filter(
    (u) => !members.some((m) => m.userId === u.id),
  );

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <Card className="border-white/10 bg-[#1a1a1a]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-[#0d7377]" />
            Team
            <Badge variant="secondary" className="ml-1">
              {members.length}
            </Badge>
          </CardTitle>
          <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8">
                <UserPlus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select User</label>
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() =>
                    addMemberMutation.mutate({
                      userId: parseInt(selectedUserId, 10),
                      role: selectedRole,
                    })
                  }
                  disabled={!selectedUserId || addMemberMutation.isPending}
                >
                  {addMemberMutation.isPending ? "Adding..." : "Add Member"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {loadingMembers ? (
              <div className="text-center text-gray-500 py-4">Loading...</div>
            ) : members.length === 0 ? (
              <div className="text-center text-gray-500 py-4">
                No team members yet
              </div>
            ) : (
              members.map((member) => {
                const RoleIcon = roleIcons[member.role] || Eye;
                const isOnline = onlineUserIds.has(member.userId);

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors"
                    data-testid={`team-member-${member.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-[#0d7377]/20 text-[#0d7377] text-xs">
                            {getInitials(member.userName, member.userEmail)}
                          </AvatarFallback>
                        </Avatar>
                        <Circle
                          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 ${
                            isOnline
                              ? "text-green-500 fill-green-500"
                              : "text-gray-500 fill-gray-500"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {member.userName || member.userEmail}
                        </p>
                        <p className="text-xs text-gray-500">
                          {member.userEmail}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`${roleColors[member.role]} text-xs`}
                      >
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {member.role}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              updateRoleMutation.mutate({
                                memberId: member.id,
                                role: "owner",
                              })
                            }
                          >
                            <Crown className="h-4 w-4 mr-2" />
                            Make Owner
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateRoleMutation.mutate({
                                memberId: member.id,
                                role: "editor",
                              })
                            }
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Make Editor
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateRoleMutation.mutate({
                                memberId: member.id,
                                role: "viewer",
                              })
                            }
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Make Viewer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-500"
                            onClick={() =>
                              removeMemberMutation.mutate(member.id)
                            }
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {onlineUsers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-gray-500 mb-2">Currently online</p>
            <div className="flex -space-x-2">
              {onlineUsers.slice(0, 5).map((user) => (
                <Avatar
                  key={user.id}
                  className="h-6 w-6 border-2 border-[#1a1a1a]"
                >
                  <AvatarFallback className="bg-green-500/20 text-green-500 text-[10px]">
                    {getInitials(user.userName, user.userEmail)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {onlineUsers.length > 5 && (
                <div className="h-6 w-6 rounded-full bg-gray-700 border-2 border-[#1a1a1a] flex items-center justify-center text-[10px]">
                  +{onlineUsers.length - 5}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TeamPanel;
