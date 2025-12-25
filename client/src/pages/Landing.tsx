import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { FileText, Brain, Zap, Shield, Menu, X, ChevronRight, ArrowRight, Search, AlertTriangle, TrendingUp, Users, Sparkles, BookOpen, CheckCircle, BarChart3, Cpu, Database, Lock, FileSearch, Play } from 'lucide-react';
import bidForgeLogo from '@assets/Gemini_Generated_Image_mb26x1mb26x1mb26_1765805920806.png';
import dashboardScreenshot from '@assets/stock_images/computer_desktop_das_b391f789.jpg';
import { useAuthStore, apiRequest } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CompanyBranding {
  companyName?: string;
  tagline?: string;
  primaryColor?: string;
  logoUrl?: string;
  aboutUs?: string;
}

const featureCategories = [
  {
    category: "Core Intelligence & Analysis",
    features: [
      {
        icon: Search,
        title: "Deep RFP Analysis",
        description: "Instant multi-dimensional scoring including Quality Score, Clarity Score, Doability Assessment, and Risk Level to assess viability before committing resources."
      },
      {
        icon: AlertTriangle,
        title: "Conflict Detection Engine",
        description: "Advanced AI identifies semantic inconsistencies and numeric contradictions within RFP requirements that human reviewers might miss."
      },
      {
        icon: TrendingUp,
        title: "Win Probability Prediction",
        description: "Data-driven predictions based on 8+ factors including capabilities and past performance to support informed go/no-go decisions."
      },
      {
        icon: Users,
        title: "Multi-Agent Intelligence",
        description: "Five specialized AI agents—Intake, Analysis, Decision, Generation, and Review—work together to handle specific aspects of the bid process."
      }
    ]
  },
  {
    category: "Content Generation & Management",
    features: [
      {
        icon: Sparkles,
        title: "Smart Bid Generation",
        description: "Generate complete professional bids in minutes using RAG that pulls from winning history and adapts to current requirements."
      },
      {
        icon: BookOpen,
        title: "Knowledge Learning System",
        description: "Continuously learns your company's strengths, voice, and strategies from every winning bid to improve future proposals."
      },
      {
        icon: CheckCircle,
        title: "Compliance Guardian",
        description: "Automates requirement tracking and verification to ensure zero compliance errors and full coverage of specifications."
      }
    ]
  },
  {
    category: "Collaboration & Workflow",
    features: [
      {
        icon: Users,
        title: "Team Collaboration Hub",
        description: "Multi-role access control, real-time collaboration, approval workflows, and comprehensive audit trails."
      },
      {
        icon: BarChart3,
        title: "Analytics & Insights",
        description: "Track performance metrics, team productivity, ROI, and win/loss patterns to drive continuous improvement."
      }
    ]
  },
  {
    category: "Technical Architecture & Security",
    features: [
      {
        icon: Cpu,
        title: "Multi-Model AI Support",
        description: "Dynamically selects between GPT-4o, Claude Sonnet 4.5, Gemini 2.5 Flash, and DeepSeek for optimal performance."
      },
      {
        icon: Database,
        title: "Hybrid Search Technology",
        description: "Combines 70% vector similarity with 30% full-text search using OpenAI embeddings for high-accuracy retrieval."
      },
      {
        icon: Lock,
        title: "Enterprise Security",
        description: "JWT authentication, 4-tier role-based access, end-to-end data encryption, and complete audit logging."
      },
      {
        icon: FileSearch,
        title: "Document Processing",
        description: "Multi-format ingestion (PDF, ZIP, DOCX, MSG) with recursive extraction and semantic chunking to preserve context."
      }
    ]
  }
];

const stats = [
  { value: "40%", label: "Higher Win Rate" },
  { value: "3x", label: "Faster Proposals" },
  { value: "500+", label: "Projects Won" },
  { value: "$2.1B", label: "Contracts Secured" }
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    const fetchBranding = async () => {
      if (isAuthenticated) {
        try {
          const response = await apiRequest('/api/branding');
          if (response.ok) {
            const data = await response.json();
            setBranding(data.brandingProfile || null);
          }
        } catch (error) {
          console.error('Failed to fetch branding:', error);
        }
      } else {
        setBranding(null);
      }
    };
    fetchBranding();
  }, [isAuthenticated]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  const displayName = branding?.companyName || user?.companyName || 'BidForge AI';
  const displayTagline = branding?.tagline || 'INTELLIGENT BIDDING';
  const displayLogo = branding?.logoUrl || bidForgeLogo;
  const primaryColor = branding?.primaryColor || '#003D82';
  const aboutUs = branding?.aboutUs || `Strategic Craftsmanship at Scale — The RFP bottleneck respects no boundaries; it stalls the growth of agile startups and drains the high-value expertise of global enterprises alike. BidForge AI exists to democratize "Strategic Craftsmanship," ensuring that a lean team can compete with the resources of a giant, while large organizations can recapture the agility of a startup.

We reject the choice between "fast and generic" or "slow and accurate." By leveraging our proprietary "Resonance Engine" and "Live Ingestion" technology, we transform your company's unique chaos—whether it's a founder's folder of PDFs or a global SharePoint library—into a precision revenue engine. We act as the "Iron Man Suit" for your revenue team, providing the velocity to clear backlogs instantly and the rigorous "Anchored Truth" required to withstand complex scrutiny. Whether you are fighting for your first major contract or defending market dominance, the Forge scales to your ambition.`;

  const privacyPolicy = `Cognitive Sovereignty for Every Scale — We believe that enterprise-grade security is a fundamental right, not just a feature for the Fortune 500. Your intellectual property is your competitive advantage, and whether you are a team of five or five thousand, BidForge AI acts as your "Vault," not a marketplace.

Our "Sovereign Shield" architecture guarantees that your data is isolated in a private tenant and protected by a strict "No-Peeking" policy: your data trains your specific model exclusively and never bleeds into public AI models (like GPT or Gemini). We combine the friction-free deployment needed by fast-moving growth teams with the "Military-Grade" security standards (SOC 2 Type II readiness, AES-256 encryption) demanded by the world's strictest CISOs.`;

  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      <nav 
        className="fixed w-full top-0 z-50 bg-white shadow-sm py-4"
        data-testid="navigation"
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 group" data-testid="link-home">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#3B82F6' }}>
              B
            </div>
            <span className="font-display text-xl font-bold text-foreground">
              BidForgeAI
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700">Home</a>
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900">Features</a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900">Pricing</a>
            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900">Resources</a>
            <button onClick={() => setAboutOpen(true)} className="text-sm font-medium text-gray-600 hover:text-gray-900">About</button>
            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900">Contact</a>
          </div>
          
          <Link 
            href="/register" 
            className="hidden md:block px-5 py-2.5 text-sm font-medium text-white rounded-full transition-all duration-300 hover:opacity-90"
            style={{ backgroundColor: '#22C55E' }}
            data-testid="button-get-started"
          >
            Get Started
          </Link>
          
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-foreground"
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white shadow-xl py-6 px-6 space-y-4">
            <a href="#" className="block text-blue-600 font-medium py-2">Home</a>
            <a href="#features" className="block text-foreground font-medium py-2">Features</a>
            <a href="#pricing" className="block text-foreground font-medium py-2">Pricing</a>
            <a href="#" className="block text-foreground font-medium py-2">Resources</a>
            <button onClick={() => setAboutOpen(true)} className="block text-foreground font-medium py-2 w-full text-left">About</button>
            <a href="#" className="block text-foreground font-medium py-2">Contact</a>
            <Link 
              href="/register" 
              className="block text-white py-3 px-4 text-center font-medium rounded-full"
              style={{ backgroundColor: '#22C55E' }}
            >
              Get Started
            </Link>
          </div>
        )}
      </nav>
      <section className="bg-white pt-32 pb-16">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-[1.1]">
            Win More Bids with{' '}
            <span className="text-blue-600">AI-Powered Precision</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Create accurate, competitive bids in minutes. BidForgeAI helps contractors maximize win rates and profits with intelligent cost estimation and market insights.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link 
              href="/register" 
              className="px-8 py-3.5 text-white font-medium rounded-lg transition-all duration-300 hover:opacity-90"
              style={{ backgroundColor: '#3B82F6' }}
              data-testid="button-start-trial"
            >
              Start Free Trial
            </Link>
            
            <button 
              className="px-8 py-3.5 border border-gray-300 font-medium rounded-lg transition-all duration-300 hover:bg-gray-50 inline-flex items-center justify-center gap-2 text-gray-700"
            >
              <Play size={18} className="fill-current" />
              Watch Demo
            </button>
          </div>
          
          <div className="flex items-center justify-center gap-2 text-gray-500 text-sm mb-12">
            <CheckCircle size={18} className="text-blue-600" />
            <span>Trusted by 500+ contractors nationwide</span>
          </div>
        </div>
        
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="rounded-xl overflow-hidden shadow-2xl">
            <img 
              src={dashboardScreenshot} 
              alt="BidForgeAI Dashboard" 
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>
      
      <section className="py-16 bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-display font-bold mb-2 text-blue-600">
                  {stat.value}
                </div>
                <div className="text-gray-600 text-sm uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="features" className="py-24 md:py-32 bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-20">
            <span 
              className="uppercase tracking-[0.2em] text-sm font-medium mb-4 block"
              style={{ color: primaryColor }}
            >
              Comprehensive Capabilities
            </span>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Built for Winning
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Every feature designed to give you an unfair advantage in proposal bidding.
            </p>
          </div>
          
          {featureCategories.map((category, catIndex) => (
            <div key={catIndex} className="mb-16 last:mb-0">
              <h3 
                className="font-display text-2xl md:text-3xl font-bold text-foreground mb-8 pb-4 border-b-2"
                style={{ borderColor: primaryColor }}
              >
                {category.category}
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {category.features.map((feature, index) => (
                  <div
                    key={index}
                    className="group bg-card p-6 border border-border hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = primaryColor)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
                    data-testid={`card-feature-${catIndex}-${index}`}
                  >
                    <div 
                      className="w-12 h-12 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
                      style={{ background: primaryColor }}
                    >
                      <feature.icon className="text-white" size={24} />
                    </div>
                    
                    <h4 className="font-display text-lg font-semibold text-foreground mb-3">
                      {feature.title}
                    </h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      
      <section id="pricing" className="py-24 md:py-32 bg-[#f8f9fa]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <span 
              className="uppercase tracking-[0.2em] text-sm font-medium mb-4 block"
              style={{ color: primaryColor }}
            >
              Simple Pricing
            </span>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Choose Your Plan
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Start with a free trial. Upgrade as you grow. No hidden fees.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-8 border border-border shadow-sm hover:shadow-lg transition-shadow">
              <div className="mb-6">
                <h3 className="font-display text-xl font-bold text-foreground mb-2">Free Trial</h3>
                <div className="text-4xl font-bold" style={{ color: primaryColor }}>
                  $0
                  <span className="text-base font-normal text-muted-foreground">/7 days</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> 1 Project
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> 1 Document
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> 2 Bid Generations
                </li>
              </ul>
              <Link 
                href="/register"
                className="block w-full py-3 text-center font-medium border-2 transition-colors"
                style={{ borderColor: primaryColor, color: primaryColor }}
                data-testid="button-trial-signup"
              >
                Start Free Trial
              </Link>
            </div>
            
            <div className="bg-white p-8 border border-border shadow-sm hover:shadow-lg transition-shadow">
              <div className="mb-6">
                <h3 className="font-display text-xl font-bold text-foreground mb-2">The Sifter</h3>
                <div className="text-4xl font-bold" style={{ color: primaryColor }}>
                  $99
                  <span className="text-base font-normal text-muted-foreground">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> 5 Projects
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> 50 Documents
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> 15 Bid Generations
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> Extra projects: $25/ea
                </li>
              </ul>
              <Link 
                href="/register"
                className="block w-full py-3 text-center font-medium text-white transition-colors"
                style={{ backgroundColor: primaryColor }}
                data-testid="button-sifter-signup"
              >
                Get Started
              </Link>
            </div>
            
            <div className="bg-white p-8 border-2 shadow-lg hover:shadow-xl transition-shadow relative" style={{ borderColor: primaryColor }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-bold text-white" style={{ backgroundColor: primaryColor }}>
                MOST POPULAR
              </div>
              <div className="mb-6">
                <h3 className="font-display text-xl font-bold text-foreground mb-2">The Estimator</h3>
                <div className="text-4xl font-bold" style={{ color: primaryColor }}>
                  $299
                  <span className="text-base font-normal text-muted-foreground">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> 20 Projects
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> 200 Documents
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> 60 Bid Generations
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> Extra projects: $25/ea
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> Priority Support
                </li>
              </ul>
              <Link 
                href="/register"
                className="block w-full py-3 text-center font-medium text-white transition-colors"
                style={{ backgroundColor: primaryColor }}
                data-testid="button-estimator-signup"
              >
                Get Started
              </Link>
            </div>
            
            <div className="bg-white p-8 border border-border shadow-sm hover:shadow-lg transition-shadow">
              <div className="mb-6">
                <h3 className="font-display text-xl font-bold text-foreground mb-2">Enterprise</h3>
                <div className="text-4xl font-bold" style={{ color: primaryColor }}>
                  $1,500
                  <span className="text-base font-normal text-muted-foreground">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> 200 Projects
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> 2,000 Documents
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> Unlimited Bids
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> Dedicated Support
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: primaryColor }}>✓</span> Custom Integrations
                </li>
              </ul>
              <Link 
                href="/register"
                className="block w-full py-3 text-center font-medium border-2 transition-colors"
                style={{ borderColor: primaryColor, color: primaryColor }}
                data-testid="button-enterprise-signup"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>
      
      <section id="testimonial" className="py-24 md:py-32 bg-[#1A1A1A] text-white relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-5"
          style={{ background: `radial-gradient(circle at center, ${primaryColor}, transparent, transparent)` }}
        />
        
        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div 
            className="font-accent text-7xl md:text-8xl mb-8 leading-none"
            style={{ color: primaryColor }}
          >"</div>
          
          <blockquote className="text-xl md:text-2xl lg:text-3xl font-light leading-relaxed mb-10 text-gray-300">
            BidForge transformed our bidding process. We went from spending 
            <span className="text-white font-medium"> 3 days per proposal </span>
            to generating comprehensive, winning bids in 
            <span style={{ color: primaryColor }} className="font-medium"> under an hour</span>.
            Our win rate increased by 40%.
          </blockquote>
          
          <div className="pt-8 border-t border-[#3D3D3D] inline-block">
            <div className="font-medium text-lg text-white mb-1">
              Sarah Mitchell
            </div>
            <div style={{ color: primaryColor }} className="text-sm tracking-wider">
              Director of Operations, Apex Construction Ltd.
            </div>
          </div>
        </div>
      </section>
      <section 
        className="py-24 md:py-32 relative overflow-hidden"
        style={{ background: `linear-gradient(to bottom right, ${primaryColor}dd, #1f2937)` }}
      >
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="cta-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cta-grid)" />
          </svg>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Ready to Win More Bids?
          </h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Join leading construction companies who trust BidForge AI to secure their most important contracts.
          </p>
          <Link 
            href="/dashboard" 
            className="group inline-flex items-center gap-3 px-12 py-6 text-white font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            style={{ backgroundColor: primaryColor }}
            data-testid="button-cta"
          >
            Get Started Now
            <ChevronRight className="group-hover:translate-x-1 transition-transform" size={24} />
          </Link>
        </div>
      </section>

      <footer className="bg-[#1A1A1A] border-t border-[#2B2B2B] py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img 
                  src={displayLogo} 
                  alt={`${displayName} Logo`} 
                  className="h-8 w-8 object-contain"
                />
                <span className="font-display text-xl font-bold text-white">{displayName}</span>
              </div>
              <p className="text-gray-400 max-w-md leading-relaxed">
                The intelligent bidding platform that learns from your wins to create better proposals, faster.
              </p>
            </div>
            <div>
              <h4 className="font-display font-semibold text-white mb-4">Platform</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#features" className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = primaryColor} onMouseLeave={(e) => e.currentTarget.style.color = ''}>Features</a></li>
                <li><Link href="/dashboard" className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = primaryColor} onMouseLeave={(e) => e.currentTarget.style.color = ''}>Dashboard</Link></li>
                <li><Link href="/templates" className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = primaryColor} onMouseLeave={(e) => e.currentTarget.style.color = ''}>Templates</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-3 text-gray-400">
                <li><button onClick={() => setAboutOpen(true)} className="transition-colors hover:text-white cursor-pointer" onMouseEnter={(e) => e.currentTarget.style.color = primaryColor} onMouseLeave={(e) => e.currentTarget.style.color = ''}>About</button></li>
                <li><a href="#" className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = primaryColor} onMouseLeave={(e) => e.currentTarget.style.color = ''}>Contact</a></li>
                <li><button onClick={() => setPrivacyOpen(true)} className="transition-colors hover:text-white cursor-pointer" onMouseEnter={(e) => e.currentTarget.style.color = primaryColor} onMouseLeave={(e) => e.currentTarget.style.color = ''}>Privacy</button></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-[#2B2B2B] flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} {displayName}. All rights reserved.
            </p>
            <p className="text-gray-600 text-sm">
              Built for construction professionals who refuse to lose.
            </p>
          </div>
        </div>
      </footer>

      {/* About Dialog */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold">About Us</DialogTitle>
          </DialogHeader>
          <div className="text-gray-600 leading-relaxed space-y-4 mt-4">
            {aboutUs.split('\n\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Dialog */}
      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold">Privacy Policy</DialogTitle>
          </DialogHeader>
          <div className="text-gray-600 leading-relaxed space-y-4 mt-4">
            {privacyPolicy.split('\n\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
