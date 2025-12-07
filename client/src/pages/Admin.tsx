import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Users,
  Shield,
  Settings,
  Activity,
  UserPlus,
  MoreVertical,
  Trash2,
  Key,
  FileText,
  FolderOpen,
  CheckCircle,
  Clock,
  Copy,
  Mail,
  UserMinus,
  UserCheck,
  Building2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface User {
  id: number;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface CompanyUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface CompanyInvite {
  id: number;
  email: string;
  role: string;
  inviteCode: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface Company {
  id: number;
  name: string;
  slug: string;
}

interface SystemStats {
  users: { total: number; active: number; admins: number; managers: number };
  projects: { total: number; active: number; won: number };
  documents: { total: number; processed: number };
  activity: { last24h: number };
}

const roleColors: Record<string, string> = {
  admin: 'bg-red-500/10 text-red-400 border-red-500/20',
  manager: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  user: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  viewer: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export default function Admin() {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'user' });
  const [newPassword, setNewPassword] = useState('');
  
  // Team tab state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [copiedInviteCode, setCopiedInviteCode] = useState<string | null>(null);
  const [teamMemberToDeactivate, setTeamMemberToDeactivate] = useState<CompanyUser | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { accessToken: token, user: currentUser } = useAuthStore();

  // Check if user is admin
  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="border-red-200 bg-white p-8 text-center shadow-lg">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-slate-800">Access Denied</h2>
          <p className="text-slate-600">You need admin privileges to access this page.</p>
          <Link href="/dashboard">
            <Button className="mt-4">Go to Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    enabled: !!token,
  });

  const { data: stats } = useQuery<SystemStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: !!token,
  });

  interface ApiStatus {
    openai: { configured: boolean; hasCustomBaseUrl: boolean };
    anthropic: { configured: boolean; hasCustomBaseUrl: boolean };
    gemini: { configured: boolean; hasCustomBaseUrl: boolean };
    database: { configured: boolean };
    whatsapp: { configured: boolean };
  }

  const { data: apiStatus } = useQuery<ApiStatus>({
    queryKey: ['admin-api-status'],
    queryFn: async () => {
      const res = await fetch('/api/admin/api-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch API status');
      return res.json();
    },
    enabled: !!token,
  });

  // Team management queries
  const { data: companyData } = useQuery<{ company: Company }>({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await fetch('/api/company', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch company');
      return res.json();
    },
    enabled: !!token,
  });

  const { data: teamUsersData = { users: [] }, isLoading: loadingTeamUsers } = useQuery<{ users: CompanyUser[] }>({
    queryKey: ['company-users'],
    queryFn: async () => {
      const res = await fetch('/api/company/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch team users');
      return res.json();
    },
    enabled: !!token,
  });

  const { data: invitesData = { invites: [] }, isLoading: loadingInvites } = useQuery<{ invites: CompanyInvite[] }>({
    queryKey: ['company-invites'],
    queryFn: async () => {
      const res = await fetch('/api/company/invites', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch invites');
      return res.json();
    },
    enabled: !!token,
  });

  // Team management mutations
  const createInviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await fetch('/api/company/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create invite');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-invites'] });
      setIsInviteOpen(false);
      setInviteEmail('');
      setInviteRole('user');
      toast({ title: 'Invitation sent successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      const res = await fetch(`/api/company/invites/${inviteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to revoke invite');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-invites'] });
      toast({ title: 'Invitation revoked' });
    },
  });

  const updateTeamRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const res = await fetch(`/api/company/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update role');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users'] });
      toast({ title: 'User role updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deactivateTeamMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/company/users/${userId}/deactivate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to deactivate user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users'] });
      setTeamMemberToDeactivate(null);
      toast({ title: 'Team member deactivated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const reactivateTeamMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/company/users/${userId}/reactivate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to reactivate user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users'] });
      toast({ title: 'Team member reactivated' });
    },
  });

  const copyInviteLink = (inviteCode: string) => {
    const link = `${window.location.origin}/invite/${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopiedInviteCode(inviteCode);
    setTimeout(() => setCopiedInviteCode(null), 2000);
    toast({ title: 'Invite link copied to clipboard' });
  };

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsAddUserOpen(false);
      setNewUser({ email: '', password: '', name: '', role: 'user' });
      toast({ title: 'User created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<User> }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'User updated' });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error('Failed to reset password');
      return res.json();
    },
    onSuccess: () => {
      setIsResetPasswordOpen(false);
      setSelectedUser(null);
      setNewPassword('');
      toast({ title: 'Password reset successfully' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteConfirmUser(null);
      toast({ title: 'User deleted' });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="text-slate-600 hover:text-slate-900">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold font-display text-slate-800">Admin Panel</h1>
              <p className="text-slate-500 mt-1">User management and system settings</p>
            </div>
          </div>
        </div>

        {/* System Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Users"
            value={stats?.users.total || 0}
            subtitle={`${stats?.users.active || 0} active`}
            icon={Users}
            color="text-[#0d7377]"
          />
          <StatCard
            title="Projects"
            value={stats?.projects.total || 0}
            subtitle={`${stats?.projects.active || 0} active`}
            icon={FolderOpen}
            color="text-[#b8995a]"
          />
          <StatCard
            title="Documents"
            value={stats?.documents.total || 0}
            subtitle={`${stats?.documents.processed || 0} processed`}
            icon={FileText}
            color="text-purple-500"
          />
          <StatCard
            title="Activity (24h)"
            value={stats?.activity.last24h || 0}
            subtitle="System events"
            icon={Activity}
            color="text-emerald-500"
          />
        </div>

        <Tabs defaultValue="team" className="space-y-6">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="team" className="data-[state=active]:bg-[#0d7377] data-[state=active]:text-white">
              <Building2 className="h-4 w-4 mr-2" />
              My Team
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-[#0d7377] data-[state=active]:text-white">
              <Users className="h-4 w-4 mr-2" />
              All Users
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-[#0d7377] data-[state=active]:text-white">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Team Tab - Company User Management */}
          <TabsContent value="team" className="space-y-6">
            {/* Company Info */}
            {companyData?.company && (
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-slate-800">
                    <Building2 className="h-5 w-5 text-[#0d7377]" />
                    {companyData.company.name}
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Manage your team members and invitations
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {/* Team Members */}
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                      <Users className="h-5 w-5 text-[#0d7377]" />
                      Team Members
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                      {teamUsersData.users.length} member{teamUsersData.users.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-[#0d7377] hover:bg-[#0d7377]/90" data-testid="button-invite-member">
                        <Mail className="h-4 w-4" />
                        Invite Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="invite-email">Email Address</Label>
                          <Input
                            id="invite-email"
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="colleague@example.com"
                            data-testid="input-invite-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select value={inviteRole} onValueChange={setInviteRole}>
                            <SelectTrigger data-testid="select-invite-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => createInviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
                          disabled={!inviteEmail || createInviteMutation.isPending}
                          data-testid="button-send-invite"
                        >
                          {createInviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead className="text-slate-600">Member</TableHead>
                      <TableHead className="text-slate-600">Role</TableHead>
                      <TableHead className="text-slate-600">Status</TableHead>
                      <TableHead className="text-slate-600">Last Active</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingTeamUsers ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          Loading team members...
                        </TableCell>
                      </TableRow>
                    ) : teamUsersData.users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          No team members found. Invite someone to get started!
                        </TableCell>
                      </TableRow>
                    ) : (
                      teamUsersData.users.map((member) => (
                        <TableRow key={member.id} className="border-slate-100" data-testid={`team-member-row-${member.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-slate-800">{member.name || 'Unnamed'}</p>
                              <p className="text-sm text-slate-500">{member.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={member.role}
                              onValueChange={(role) => updateTeamRoleMutation.mutate({ userId: member.id, role })}
                              disabled={member.id === currentUser?.id}
                            >
                              <SelectTrigger className="w-28">
                                <Badge variant="outline" className={roleColors[member.role]}>
                                  {member.role}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.isActive ? 'default' : 'secondary'} className={member.isActive ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-gray-500/10 text-gray-500'}>
                              {member.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {member.lastLoginAt 
                              ? formatDistanceToNow(new Date(member.lastLoginAt), { addSuffix: true })
                              : 'Never'
                            }
                          </TableCell>
                          <TableCell>
                            {member.id !== currentUser?.id && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {member.isActive ? (
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => setTeamMemberToDeactivate(member)}
                                    >
                                      <UserMinus className="h-4 w-4 mr-2" />
                                      Deactivate
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => reactivateTeamMemberMutation.mutate(member.id)}
                                    >
                                      <UserCheck className="h-4 w-4 mr-2" />
                                      Reactivate
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Pending Invitations */}
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Mail className="h-5 w-5 text-[#b8995a]" />
                  Pending Invitations
                </CardTitle>
                <CardDescription className="text-slate-500">
                  {invitesData.invites.filter(i => i.status === 'pending').length} pending invitation{invitesData.invites.filter(i => i.status === 'pending').length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead className="text-slate-600">Email</TableHead>
                      <TableHead className="text-slate-600">Role</TableHead>
                      <TableHead className="text-slate-600">Status</TableHead>
                      <TableHead className="text-slate-600">Expires</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingInvites ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          Loading invitations...
                        </TableCell>
                      </TableRow>
                    ) : invitesData.invites.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          No pending invitations
                        </TableCell>
                      </TableRow>
                    ) : (
                      invitesData.invites.map((invite) => (
                        <TableRow key={invite.id} className="border-slate-100" data-testid={`invite-row-${invite.id}`}>
                          <TableCell className="text-slate-800">{invite.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={roleColors[invite.role]}>
                              {invite.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={invite.status === 'pending' ? 'secondary' : 'outline'} className={
                              invite.status === 'pending' 
                                ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                                : invite.status === 'accepted'
                                ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                : 'bg-red-500/10 text-red-600 border-red-500/20'
                            }>
                              {invite.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {formatDistanceToNow(new Date(invite.expiresAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => copyInviteLink(invite.inviteCode)}
                                title="Copy invite link"
                              >
                                {copiedInviteCode === invite.inviteCode ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              {invite.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600"
                                  onClick={() => revokeInviteMutation.mutate(invite.id)}
                                  title="Revoke invitation"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Deactivate Team Member Confirmation */}
            <AlertDialog open={!!teamMemberToDeactivate} onOpenChange={(open) => !open && setTeamMemberToDeactivate(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate Team Member</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to deactivate {teamMemberToDeactivate?.name || teamMemberToDeactivate?.email}? 
                    They will no longer be able to access the system.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => teamMemberToDeactivate && deactivateTeamMemberMutation.mutate(teamMemberToDeactivate.id)}
                  >
                    Deactivate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                      <Users className="h-5 w-5 text-[#0d7377]" />
                      User Management
                    </CardTitle>
                    <CardDescription className="text-slate-500">Manage user accounts and permissions</CardDescription>
                  </div>
                  <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-[#0d7377] hover:bg-[#0d7377]/90">
                        <UserPlus className="h-4 w-4" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New User</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                            placeholder="user@example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input
                            id="name"
                            value={newUser.name}
                            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                            placeholder="John Doe"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                            placeholder="Minimum 8 characters"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => createUserMutation.mutate(newUser)}
                          disabled={!newUser.email || !newUser.password || createUserMutation.isPending}
                        >
                          {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead className="text-slate-600">User</TableHead>
                      <TableHead className="text-slate-600">Role</TableHead>
                      <TableHead className="text-slate-600">Status</TableHead>
                      <TableHead className="text-slate-600">Last Login</TableHead>
                      <TableHead className="text-slate-600">Created</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingUsers ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                          Loading users...
                        </TableCell>
                      </TableRow>
                    ) : allUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      allUsers.map((user) => (
                        <TableRow key={user.id} className="border-slate-100" data-testid={`user-row-${user.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-slate-800">{user.name || 'Unnamed'}</p>
                              <p className="text-sm text-slate-500">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={roleColors[user.role]}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={user.isActive}
                                onCheckedChange={(checked) => 
                                  updateUserMutation.mutate({ id: user.id, data: { isActive: checked } })
                                }
                                disabled={user.id === currentUser?.id}
                              />
                              <span className={user.isActive ? 'text-green-500' : 'text-gray-500'}>
                                {user.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {user.lastLoginAt 
                              ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                              : 'Never'
                            }
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => 
                                  updateUserMutation.mutate({ id: user.id, data: { role: 'admin' } })
                                }>
                                  <Shield className="h-4 w-4 mr-2" />
                                  Make Admin
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => 
                                  updateUserMutation.mutate({ id: user.id, data: { role: 'manager' } })
                                }>
                                  Make Manager
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => 
                                  updateUserMutation.mutate({ id: user.id, data: { role: 'user' } })
                                }>
                                  Make User
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => {
                                  setSelectedUser(user);
                                  setIsResetPasswordOpen(true);
                                }}>
                                  <Key className="h-4 w-4 mr-2" />
                                  Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-500"
                                  onClick={() => setDeleteConfirmUser(user)}
                                  disabled={user.id === currentUser?.id}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Settings className="h-5 w-5 text-[#0d7377]" />
                  System Settings
                </CardTitle>
                <CardDescription className="text-slate-500">Configure system-wide settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>How to configure API keys:</strong> API keys are managed securely through environment secrets. 
                    To add or update keys, go to the <strong>Secrets</strong> tab in Replit's Tools panel (lock icon in the sidebar).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-800">AI Configuration</h3>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-slate-600">OpenAI API</span>
                          <p className="text-xs text-slate-400">AI_INTEGRATIONS_OPENAI_API_KEY</p>
                        </div>
                        <Badge variant="outline" className={apiStatus?.openai?.configured 
                          ? "bg-green-50 text-green-600 border-green-200" 
                          : "bg-red-50 text-red-600 border-red-200"}>
                          {apiStatus?.openai?.configured ? 'Configured' : 'Not Set'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-slate-600">Anthropic API</span>
                          <p className="text-xs text-slate-400">AI_INTEGRATIONS_ANTHROPIC_API_KEY</p>
                        </div>
                        <Badge variant="outline" className={apiStatus?.anthropic?.configured 
                          ? "bg-green-50 text-green-600 border-green-200" 
                          : "bg-red-50 text-red-600 border-red-200"}>
                          {apiStatus?.anthropic?.configured ? 'Configured' : 'Not Set'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-slate-600">Google Gemini API</span>
                          <p className="text-xs text-slate-400">AI_INTEGRATIONS_GEMINI_API_KEY</p>
                        </div>
                        <Badge variant="outline" className={apiStatus?.gemini?.configured 
                          ? "bg-green-50 text-green-600 border-green-200" 
                          : "bg-red-50 text-red-600 border-red-200"}>
                          {apiStatus?.gemini?.configured ? 'Configured' : 'Not Set'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-800">Database</h3>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-slate-600">PostgreSQL</span>
                          <p className="text-xs text-slate-400">DATABASE_URL</p>
                        </div>
                        <Badge variant="outline" className={apiStatus?.database?.configured 
                          ? "bg-green-50 text-green-600 border-green-200" 
                          : "bg-red-50 text-red-600 border-red-200"}>
                          {apiStatus?.database?.configured ? 'Connected' : 'Not Set'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">pgvector Extension</span>
                        <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Enabled</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-800">Security</h3>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">JWT Authentication</span>
                        <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Active</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Rate Limiting</span>
                        <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Enabled</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Audit Logging</span>
                        <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Active</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-800">Integrations</h3>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-slate-600">WhatsApp API</span>
                          <p className="text-xs text-slate-400">WA_PHONE_NUMBER_ID + CLOUD_API_ACCESS_TOKEN</p>
                        </div>
                        <Badge variant="outline" className={apiStatus?.whatsapp?.configured 
                          ? "bg-green-50 text-green-600 border-green-200" 
                          : "bg-amber-50 text-amber-600 border-amber-200"}>
                          {apiStatus?.whatsapp?.configured ? 'Configured' : 'Not Configured'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-gray-400">
              Reset password for <strong>{selectedUser?.email}</strong>
            </p>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (selectedUser) {
                  resetPasswordMutation.mutate({ id: selectedUser.id, password: newPassword });
                }
              }}
              disabled={!newPassword || newPassword.length < 8 || resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmUser} onOpenChange={() => setDeleteConfirmUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteConfirmUser?.email}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => {
                if (deleteConfirmUser) {
                  deleteUserMutation.mutate(deleteConfirmUser.id);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: typeof Users;
  color: string;
}

function StatCard({ title, value, subtitle, icon: Icon, color }: StatCardProps) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          </div>
          <div className={`p-3 rounded-lg ${color.replace('text-', 'bg-')}/10`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
