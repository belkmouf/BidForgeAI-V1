import { useState } from 'react';
import { useLocation } from 'wouter';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings as SettingsIcon, Bell, Palette, Shield, User, LogOut, Lock, Loader2 } from 'lucide-react';
import { useAuthStore, logout, apiRequest } from '@/lib/auth';

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const response = await apiRequest('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        const data = await response.json();
        updateUser(data.user);
        setProfileSuccess('Profile updated successfully');
      } else {
        const error = await response.json();
        setProfileError(error.error || 'Failed to update profile');
      }
    } catch (error) {
      setProfileError('Network error. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      setPasswordLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      setPasswordLoading(false);
      return;
    }

    try {
      const response = await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (response.ok) {
        setPasswordSuccess('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const error = await response.json();
        setPasswordError(error.error || 'Failed to change password');
      }
    } catch (error) {
      setPasswordError('Network error. Please try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      
      <main className="flex-1 ml-64 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-display font-bold">Settings</h1>
            </div>
            {isAuthenticated && (
              <Button
                variant="outline"
                onClick={handleLogout}
                className="text-red-500 border-red-500 hover:bg-red-500/10"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            {isAuthenticated && (
              <>
                <Card data-testid="card-profile-settings">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Profile
                    </CardTitle>
                    <CardDescription>
                      Manage your account information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                      {profileSuccess && (
                        <Alert className="bg-green-900/20 border-green-500/50">
                          <AlertDescription className="text-green-400">{profileSuccess}</AlertDescription>
                        </Alert>
                      )}
                      {profileError && (
                        <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                          <AlertDescription>{profileError}</AlertDescription>
                        </Alert>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            value={user?.email || ''}
                            disabled
                            className="bg-muted"
                            data-testid="input-user-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Input
                            id="role"
                            value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''}
                            disabled
                            className="bg-muted"
                            data-testid="input-user-role"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          data-testid="input-user-name"
                        />
                      </div>
                      <Button type="submit" disabled={profileLoading} data-testid="button-save-profile">
                        {profileLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save Profile
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card data-testid="card-password-settings">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Change Password
                    </CardTitle>
                    <CardDescription>
                      Update your password
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      {passwordSuccess && (
                        <Alert className="bg-green-900/20 border-green-500/50">
                          <AlertDescription className="text-green-400">{passwordSuccess}</AlertDescription>
                        </Alert>
                      )}
                      {passwordError && (
                        <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                          <AlertDescription>{passwordError}</AlertDescription>
                        </Alert>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <Input
                          id="current-password"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          required
                          data-testid="input-current-password"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <Input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                            data-testid="input-new-password"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">Confirm Password</Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            data-testid="input-confirm-password"
                          />
                        </div>
                      </div>
                      <Button type="submit" disabled={passwordLoading} data-testid="button-change-password">
                        {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Change Password
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </>
            )}

            <Card data-testid="card-company-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Company Information
                </CardTitle>
                <CardDescription>
                  Configure your company details for bid proposals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Company Name</Label>
                    <Input id="company-name" placeholder="Your Company Inc." data-testid="input-company-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license">License Number</Label>
                    <Input id="license" placeholder="ABC-12345" data-testid="input-license" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Company Address</Label>
                  <Input id="address" placeholder="123 Construction Ave, City, State 12345" data-testid="input-address" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" placeholder="(555) 123-4567" data-testid="input-phone" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="bids@yourcompany.com" data-testid="input-email" />
                  </div>
                </div>
                <Button data-testid="button-save-company">Save Company Info</Button>
              </CardContent>
            </Card>

            <Card data-testid="card-notification-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Manage your notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive updates about bid submissions</p>
                  </div>
                  <Switch data-testid="switch-email-notifications" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Deadline Reminders</Label>
                    <p className="text-sm text-muted-foreground">Get reminded before bid deadlines</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-deadline-reminders" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>AI Generation Complete</Label>
                    <p className="text-sm text-muted-foreground">Notify when bid generation is complete</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-ai-complete" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-appearance-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Appearance
                </CardTitle>
                <CardDescription>
                  Customize how BidForge looks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">Use dark theme throughout the app</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-dark-mode" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Compact View</Label>
                    <p className="text-sm text-muted-foreground">Show more content with smaller spacing</p>
                  </div>
                  <Switch data-testid="switch-compact-view" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
