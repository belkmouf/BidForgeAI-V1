import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mail, Lock, User, UserPlus, Building2, FileText, Database } from "lucide-react";
import { register } from "@/lib/auth";
import bidForgeLogo from "@assets/Gemini_Generated_Image_mb26x1mb26x1mb26_1765805920806.png";

export default function Register() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ragreadyCollectionId, setRagreadyCollectionId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

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

    const result = await register(email, password, name, companyName, ragreadyCollectionId || undefined);
    
    if (result.success) {
      setLocation("/dashboard");
    } else {
      setError(result.error || "Registration failed");
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
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
            Get started with BidForge AI
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
                          <strong>Disclaimer:</strong> This document is a draft for educational and planning purposes. It does not constitute legal advice. You must have this reviewed by a qualified attorney in your jurisdiction.
                        </p>

                        <div className="text-center border-b pb-4 mb-4">
                          <h2 className="text-lg font-bold text-slate-800 m-0">DRAFT USER AGREEMENT (TERMS OF SERVICE)</h2>
                          <p className="text-sm text-slate-500 m-0">Platform: BidForgeAI.com</p>
                          <p className="text-sm text-slate-500 m-0">Last Updated: December 22, 2025</p>
                        </div>

                        <section>
                          <h3 className="text-base font-semibold text-slate-800">1. Introduction and Acceptance</h3>
                          <p>This User Agreement ("Agreement") is a binding legal contract between you ("User," "You," or "Customer") and <strong>BidForgeAI</strong> ("Company," "We," "Us," or "Our"). By registering for, accessing, or using the services provided at <strong>bidforgeai.com</strong> (the "Service"), you agree to be bound by these terms.</p>
                          <p className="font-semibold">IF YOU DO NOT AGREE TO ALL OF THESE TERMS, DO NOT USE THE SERVICE.</p>
                        </section>

                        <section>
                          <h3 className="text-base font-semibold text-slate-800">2. The Nature of AI Services</h3>
                          <p>You acknowledge that the Service utilizes Generative Artificial Intelligence ("AI") technologies, including Large Language Models (LLMs), to assist in drafting, analyzing, and summarizing Request for Proposal (RFP) and Request for Quotation (RFQ) responses.</p>
                          
                          <h4 className="text-sm font-semibold text-slate-700 mt-3">2.1 No Guarantee of Accuracy (The "Hallucination" Clause)</h4>
                          <p><strong>IMPORTANT:</strong> AI technologies are probabilistic and experimental. They may produce "hallucinations"—content that sounds plausible but is factually incorrect, nonsensical, or unrelated to your input.</p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li><strong>We do not guarantee</strong> that the AI-generated content is accurate, complete, valid, or compliant with specific RFP requirements.</li>
                            <li><strong>We do not guarantee</strong> that the calculations, pricing models, or technical specifications generated by the AI are mathematically or technically correct.</li>
                          </ul>
                        </section>

                        <section>
                          <h3 className="text-base font-semibold text-slate-800">3. Mandatory Human Verification ("Human-in-the-Loop")</h3>
                          <p><strong>You agree that you are solely responsible for reviewing, verifying, and validating all output generated by BidForgeAI.</strong></p>
                          
                          <h4 className="text-sm font-semibold text-slate-700 mt-3">3.1 Your Obligation to Verify</h4>
                          <p>Before submitting, sharing, or relying on any content generated by the Service, you must:</p>
                          <ol className="list-decimal pl-5 space-y-1">
                            <li><strong>Verify Facts:</strong> Cross-reference all technical data, dates, and compliance claims against the original RFP documents.</li>
                            <li><strong>Check Pricing:</strong> Manually validate all financial figures, currency conversions, and cost estimates.</li>
                            <li><strong>Review Legal Terms:</strong> Ensure that any generated legal language complies with your internal policies and the laws of the jurisdiction in which you are bidding.</li>
                          </ol>

                          <h4 className="text-sm font-semibold text-slate-700 mt-3">3.2 Waiver of Reliance</h4>
                          <p>You expressly agree that you will not rely solely on the Service for critical decision-making. You acknowledge that <strong>BidForgeAI is a drafting aid, not a substitute for professional human judgment</strong>, engineering review, or legal counsel.</p>
                        </section>

                        <section>
                          <h3 className="text-base font-semibold text-slate-800">4. User Liability for Submissions</h3>
                          <p><strong>You assume full liability for any RFP, RFQ, or tender response you submit that utilizes content from BidForgeAI.</strong></p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Submission Errors:</strong> If you submit a bid containing errors (e.g., incorrect pricing, missing certifications, false technical claims) caused by AI generation, <strong>you bear the sole consequences</strong>, including but not limited to bid disqualification, contractual penalties, financial loss, or reputational damage.</li>
                            <li><strong>No Vicarious Liability:</strong> BidForgeAI shall not be considered a partner, joint venturer, or co-author of your bids. We are a software provider only.</li>
                          </ul>
                        </section>

                        <section>
                          <h3 className="text-base font-semibold text-slate-800">5. Intellectual Property</h3>
                          <h4 className="text-sm font-semibold text-slate-700 mt-3">5.1 Your Data</h4>
                          <p>You retain ownership of the data and documents you upload to the Service ("User Input"). You grant us a limited, non-exclusive license to process this data solely to provide the Service to you.</p>
                          
                          <h4 className="text-sm font-semibold text-slate-700 mt-3">5.2 AI Output</h4>
                          <p>Subject to your compliance with this Agreement, BidForgeAI assigns to you all right, title, and interest in the final output generated by the Service for your specific inputs.</p>
                        </section>

                        <section>
                          <h3 className="text-base font-semibold text-slate-800">6. Limitation of Liability (The "Shield")</h3>
                          <p className="font-semibold">TO THE FULLEST EXTENT PERMITTED BY LAW, BIDFORGEAI SHALL NOT BE LIABLE FOR:</p>
                          <ol className="list-decimal pl-5 space-y-1">
                            <li><strong>Lost Bids or Revenue:</strong> Any loss of business, loss of contract, failure to win a tender, or loss of anticipated savings arising from your use of the Service.</li>
                            <li><strong>Inaccurate Content:</strong> Damages resulting from errors, omissions, or inaccuracies in the AI-generated content.</li>
                            <li><strong>Indirect Damages:</strong> Any indirect, incidental, special, consequential, or punitive damages.</li>
                          </ol>
                          <p className="mt-2"><strong>CAP ON LIABILITY:</strong> IN NO EVENT SHALL BIDFORGEAI'S TOTAL AGGREGATE LIABILITY EXCEED THE AMOUNT ACTUALLY PAID BY YOU TO BIDFORGEAI FOR THE SERVICE IN THE <strong>SIX (6) MONTHS</strong> PRECEDING THE CLAIM.</p>
                        </section>

                        <section>
                          <h3 className="text-base font-semibold text-slate-800">7. Indemnification</h3>
                          <p>You agree to defend, indemnify, and hold harmless BidForgeAI, its officers, directors, and employees from and against any claims, liabilities, damages, losses, and expenses (including legal fees) arising out of or in any way connected with:</p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Your use of the Service.</strong></li>
                            <li><strong>Any RFP/RFQ response you submit</strong> (including claims by third parties regarding false advertising, breach of contract, or negligence).</li>
                            <li><strong>Your violation of any third-party rights</strong> (including intellectual property or confidentiality obligations contained in the RFPs you upload).</li>
                          </ul>
                        </section>

                        <section>
                          <h3 className="text-base font-semibold text-slate-800">8. Data Security and Confidentiality</h3>
                          <p>While we employ industry-standard security measures, you acknowledge that no AI processing pipeline is 100% secure. You agree not to upload highly sensitive information (such as state secrets, classified government data, or unredacted PII) unless explicitly covered by a separate Enterprise Agreement.</p>
                        </section>

                        <section>
                          <h3 className="text-base font-semibold text-slate-800">9. Governing Law and Dispute Resolution</h3>
                          <p>This Agreement shall be governed by the laws of the applicable jurisdiction. Any dispute arising from this Agreement shall be resolved through binding arbitration, except that either party may seek injunctive relief in court.</p>
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
    </div>
  );
}
