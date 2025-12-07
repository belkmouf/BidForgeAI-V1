import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, User, Building2, UserCheck, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import bidForgeLogo from "@assets/generated_images/bidforge_ai_premium_logo.png";

interface InviteDetails {
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  companyName: string;
}

export default function AcceptInvite() {
  const [, setLocation] = useLocation();
  const params = useParams<{ code: string }>();
  const inviteCode = params.code;
  
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInvite, setIsLoadingInvite] = useState(true);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    const fetchInvite = async () => {
      if (!inviteCode) {
        setInviteError("Invalid invitation link");
        setIsLoadingInvite(false);
        return;
      }

      try {
        const res = await fetch(`/api/invites/${inviteCode}`);
        const data = await res.json();

        if (!res.ok) {
          setInviteError(data.error || "Invitation not found");
        } else {
          setInvite(data.invite);
          if (data.invite.status !== 'pending') {
            setInviteError("This invitation has already been used or revoked");
          } else if (new Date(data.invite.expiresAt) < new Date()) {
            setInviteError("This invitation has expired");
          }
        }
      } catch {
        setInviteError("Failed to load invitation details");
      } finally {
        setIsLoadingInvite(false);
      }
    };

    fetchInvite();
  }, [inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode,
          password,
          name,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.details?.[0]?.message || "Failed to accept invitation");
      } else {
        useAuthStore.getState().setAuth(
          { 
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            role: data.user.role,
            companyId: data.user.companyId || null,
            companyName: invite?.companyName || null,
          },
          data.accessToken,
          ''
        );
        setLocation("/dashboard");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
        <Card className="w-full max-w-md bg-white border-deep-teal/30 shadow-xl">
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#0d7377]" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
        <Card className="w-full max-w-md bg-white border-red-200 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <AlertCircle className="h-16 w-16 text-red-500" />
            </div>
            <CardTitle className="text-2xl font-syne text-slate-800">Invalid Invitation</CardTitle>
            <CardDescription className="text-slate-500">
              {inviteError || "This invitation is not valid"}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => setLocation("/login")} variant="outline">
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <Card className="w-full max-w-md bg-white border-deep-teal/30 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img 
              src={bidForgeLogo} 
              alt="BidForge AI" 
              className="h-16 w-auto mx-auto"
            />
          </div>
          <CardTitle className="text-2xl font-syne text-slate-800">Join {invite.companyName}</CardTitle>
          <CardDescription className="text-slate-500">
            You've been invited to join as a{' '}
            <Badge variant="outline" className="ml-1 capitalize">{invite.role}</Badge>
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                <AlertDescription data-testid="error-message">{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Building2 className="h-4 w-4" />
                <span>Joining: <strong>{invite.companyName}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                <UserCheck className="h-4 w-4" />
                <span>Email: <strong>{invite.email}</strong></span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-700">Your Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                  required
                  data-testid="input-name"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">Create Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                  required
                  minLength={8}
                  data-testid="input-password"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                  required
                  data-testid="input-confirm-password"
                />
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full hover:bg-deep-teal/80 text-white bg-[#151719]"
              disabled={isLoading || !name || !password}
              data-testid="button-accept-invite"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="mr-2 h-4 w-4" />
              )}
              Accept Invitation
            </Button>
            
            <p className="text-sm text-slate-500 text-center">
              Already have an account?{" "}
              <a 
                href="/login" 
                className="text-deep-teal hover:underline font-medium"
                data-testid="link-login"
              >
                Sign in
              </a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
