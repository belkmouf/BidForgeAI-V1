import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mail, Lock, User, UserPlus, Building2, FileText, Database, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { register } from "@/lib/auth";
import bidForgeLogo from "@assets/Gemini_Generated_Image_mb26x1mb26x1mb26_1765805920806.png";

interface Plan {
  id: number;
  name: string;
  displayName: string;
  tier: number;
  monthlyPrice: number | null;
  monthlyProjectLimit: number | null;
  monthlyDocumentLimit: number | null;
  monthlyBidLimit: number | null;
}

export default function Register() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ragreadyCollectionId, setRagreadyCollectionId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch('/api/billing/public-plans');
        if (res.ok) {
          const data = await res.json();
          setPlans(data.plans || []);
        }
      } catch (err) {
        console.error('Failed to fetch plans:', err);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!agreedToTerms) {
      setError("You must agree to the User Agreement to create an account");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    const result = await register(
      email, 
      password, 
      name, 
      companyName, 
      ragreadyCollectionId || undefined,
      selectedPlanId || undefined
    );
    
    if (result.success) {
      setLocation("/dashboard");
    } else {
      setError(result.error || "Registration failed");
    }
    
    setIsLoading(false);
  };

  const getPlanFeatures = (plan: Plan) => {
    const features = [];
    if (plan.monthlyProjectLimit) {
      features.push(`${plan.monthlyProjectLimit} Project${plan.monthlyProjectLimit > 1 ? 's' : ''}`);
    } else {
      features.push('200 Projects');
    }
    if (plan.monthlyDocumentLimit) {
      features.push(`${plan.monthlyDocumentLimit} Document${plan.monthlyDocumentLimit > 1 ? 's' : ''}`);
    } else {
      features.push('2,000 Documents');
    }
    if (plan.monthlyBidLimit) {
      features.push(`${plan.monthlyBidLimit} Bid Generation${plan.monthlyBidLimit > 1 ? 's' : ''}`);
    } else {
      features.push('Unlimited Bids');
    }
    return features;
  };

  if (loadingPlans) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      {step === 1 ? (
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <img 
              src={bidForgeLogo} 
              alt="BidForge AI" 
              className="h-16 w-auto mx-auto mb-4"
            />
            <h1 className="text-3xl font-bold text-slate-800">Choose Your Plan</h1>
            <p className="text-slate-500 mt-2">Start with a free trial or select a plan that fits your needs</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {plans.map((plan) => (
              <Card 
                key={plan.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedPlanId === plan.id 
                    ? 'border-2 border-primary ring-2 ring-primary/20' 
                    : 'border-slate-200 hover:border-primary/50'
                }`}
                onClick={() => setSelectedPlanId(plan.id)}
                data-testid={`card-plan-${plan.tier}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{plan.displayName}</CardTitle>
                      <CardDescription className="mt-1">
                        {plan.tier === 0 ? '7-day trial' : 
                         plan.tier === 3 ? 'Custom pricing' : 'Monthly billing'}
                      </CardDescription>
                    </div>
                    {selectedPlanId === plan.id && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-800 mb-4">
                    {plan.monthlyPrice === null || plan.monthlyPrice === 0 
                      ? '$0' 
                      : `$${plan.monthlyPrice}`}
                    <span className="text-sm font-normal text-slate-500">
                      {plan.tier === 0 ? '' : '/mo'}
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-600">
                    {getPlanFeatures(plan).map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => setLocation('/login')}
              data-testid="button-back-to-login"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
            <Button
              onClick={() => {
                if (!selectedPlanId) {
                  setError("Please select a plan to continue");
                  return;
                }
                setError("");
                setStep(2);
              }}
              disabled={plans.length === 0}
              data-testid="button-continue"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          {error && (
            <Alert variant="destructive" className="mt-4 max-w-md mx-auto">
              <AlertDescription data-testid="error-message-step1">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <Card className="w-full max-w-md bg-white border-primary/30 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <img 
                src={bidForgeLogo} 
                alt="BidForge AI" 
                className="h-16 w-auto mx-auto"
              />
            </div>
            <CardTitle className="text-2xl font-syne text-slate-800">Create Account</CardTitle>
            <CardDescription className="text-slate-500">
              {(() => {
                const selectedPlan = plans.find(p => p.id === selectedPlanId);
                const isPaid = selectedPlan && selectedPlan.tier > 0;
                return (
                  <>
                    <span className={isPaid ? 'text-amber-600 font-medium' : ''}>
                      {selectedPlan?.displayName || 'Free Trial'}
                      {isPaid && ` - $${selectedPlan?.monthlyPrice}/mo`}
                    </span>
                    <button 
                      onClick={() => setStep(1)} 
                      className="text-primary hover:underline ml-2"
                      data-testid="button-change-plan"
                    >
                      Change
                    </button>
                    {isPaid && (
                      <span className="block text-xs text-amber-600 mt-1">
                        Payment will be required after account creation
                      </span>
                    )}
                  </>
                );
              })()}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                  <AlertDescription data-testid="error-message">{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                    data-testid="input-name"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-slate-700">Company Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Your Company Name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="pl-10 bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                    data-testid="input-company-name"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ragreadyCollectionId" className="text-slate-700">
                  RagReady Collection ID <span className="text-slate-400 text-xs">(optional)</span>
                </Label>
                <div className="relative">
                  <Database className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="ragreadyCollectionId"
                    type="text"
                    placeholder="Your RagReady collection ID"
                    value={ragreadyCollectionId}
                    onChange={(e) => setRagreadyCollectionId(e.target.value)}
                    className="pl-10 bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                    data-testid="input-ragready-collection-id"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Connect your{" "}
                  <a 
                    href="https://www.ragready.io" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    RagReady.io
                  </a>
                  {" "}document library for enhanced bid intelligence
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">Password</Label>
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

              <div className="flex items-start space-x-3 pt-2">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                  className="mt-1 border-slate-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  data-testid="checkbox-terms"
                />
                <div className="text-sm text-slate-600 leading-relaxed">
                  <label htmlFor="terms" className="cursor-pointer">
                    I have read and agree to the{" "}
                  </label>
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                        data-testid="button-view-terms"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        User Agreement
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                          <FileText className="h-5 w-5 text-primary" />
                          BidForgeAI User Agreement
                        </DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="h-[60vh] pr-4">
                        <div className="prose prose-sm max-w-none text-slate-700 space-y-4">
                          <p className="text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs">
                            <strong>Disclaimer:</strong> This document is a draft for educational and planning purposes. It does not constitute legal advice.
                          </p>
                          <div className="text-center border-b pb-4 mb-4">
                            <h2 className="text-lg font-bold text-slate-800 m-0">DRAFT USER AGREEMENT</h2>
                            <p className="text-sm text-slate-500 m-0">Last Updated: December 22, 2025</p>
                          </div>
                          <section>
                            <h3 className="text-base font-semibold text-slate-800">1. Introduction</h3>
                            <p>This User Agreement is a binding legal contract between you and BidForgeAI. By using the service, you agree to be bound by these terms.</p>
                          </section>
                          <section>
                            <h3 className="text-base font-semibold text-slate-800">2. AI Services</h3>
                            <p>You acknowledge that AI technologies may produce inaccurate content. You are solely responsible for reviewing and validating all output.</p>
                          </section>
                          <section>
                            <h3 className="text-base font-semibold text-slate-800">3. Limitation of Liability</h3>
                            <p>BidForgeAI shall not be liable for lost bids, inaccurate content, or indirect damages.</p>
                          </section>
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full text-white bg-primary hover:bg-primary/90"
                disabled={isLoading}
                data-testid="button-register"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Create Account
              </Button>
              
              <p className="text-sm text-slate-500 text-center">
                Already have an account?{" "}
                <a 
                  href="/login" 
                  className="text-primary hover:underline font-medium"
                  data-testid="link-login"
                >
                  Sign in
                </a>
              </p>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}
