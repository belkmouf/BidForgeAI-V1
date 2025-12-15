import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { FileText, Brain, Zap, Shield, Menu, X, ChevronRight, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import constructionBg from '@assets/stock_images/construction_site_bu_f0afb754.jpg';
import bidForgeLogo from '@assets/Gemini_Generated_Image_mb26x1mb26x1mb26_1765805920806.png';
import { useAuthStore, apiRequest } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CompanyBranding {
  companyName?: string;
  tagline?: string;
  primaryColor?: string;
  logoUrl?: string;
  aboutUs?: string;
}

const features = [
  {
    icon: Brain,
    title: "Learning Intelligence",
    description: "Automatically learns from your Closed-Won projects to improve future bids with every success.",
    stat: "75%",
    statLabel: "Faster bid creation"
  },
  {
    icon: FileText,
    title: "Multi-Format Ingestion",
    description: "Process PDFs, Outlook emails, and nested ZIP archives seamlessly with recursive extraction.",
    stat: "10+",
    statLabel: "File formats supported"
  },
  {
    icon: Zap,
    title: "AI-Powered Refinement",
    description: "Iteratively improve bids through natural language feedback with multiple AI providers.",
    stat: "3 min",
    statLabel: "Average refinement time"
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-level encryption with full audit trails and data sovereignty for your sensitive bid data.",
    stat: "99.9%",
    statLabel: "Uptime SLA"
  }
];

const stats = [
  { value: "40%", label: "Higher Win Rate" },
  { value: "3x", label: "Faster Proposals" },
  { value: "500+", label: "Projects Won" },
  { value: "$2.1B", label: "Contracts Secured" }
];

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (heroRef.current) {
      const elements = heroRef.current.querySelectorAll('.animate-in');
      gsap.from(elements, {
        y: 60,
        opacity: 0,
        duration: 1.2,
        stagger: 0.15,
        ease: 'power3.out'
      });
    }
  }, []);

  const displayName = branding?.companyName || user?.companyName || 'BidForge AI';
  const displayTagline = branding?.tagline || 'INTELLIGENT BIDDING';
  const displayLogo = branding?.logoUrl || bidForgeLogo;
  const primaryColor = branding?.primaryColor || '#0d9488';
  const aboutUs = branding?.aboutUs || `Strategic Craftsmanship at Scale — The RFP bottleneck respects no boundaries; it stalls the growth of agile startups and drains the high-value expertise of global enterprises alike. BidForge AI exists to democratize "Strategic Craftsmanship," ensuring that a lean team can compete with the resources of a giant, while large organizations can recapture the agility of a startup.

We reject the choice between "fast and generic" or "slow and accurate." By leveraging our proprietary "Resonance Engine" and "Live Ingestion" technology, we transform your company's unique chaos—whether it's a founder's folder of PDFs or a global SharePoint library—into a precision revenue engine. We act as the "Iron Man Suit" for your revenue team, providing the velocity to clear backlogs instantly and the rigorous "Anchored Truth" required to withstand complex scrutiny. Whether you are fighting for your first major contract or defending market dominance, the Forge scales to your ambition.`;

  const privacyPolicy = `Cognitive Sovereignty for Every Scale — We believe that enterprise-grade security is a fundamental right, not just a feature for the Fortune 500. Your intellectual property is your competitive advantage, and whether you are a team of five or five thousand, BidForge AI acts as your "Vault," not a marketplace.

Our "Sovereign Shield" architecture guarantees that your data is isolated in a private tenant and protected by a strict "No-Peeking" policy: your data trains your specific model exclusively and never bleeds into public AI models (like GPT or Gemini). We combine the friction-free deployment needed by fast-moving growth teams with the "Military-Grade" security standards (SOC 2 Type II readiness, AES-256 encryption) demanded by the world's strictest CISOs.`;

  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      <nav 
        className={`fixed w-full top-0 z-50 transition-all duration-500 ${
          scrolled 
            ? 'bg-white/95 backdrop-blur-md shadow-lg py-4' 
            : 'bg-transparent py-6'
        }`}
        data-testid="navigation"
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 group" data-testid="link-home">
            <img 
              src={displayLogo} 
              alt={`${displayName} Logo`} 
              className="h-10 w-10 object-contain"
            />
            <div>
              <div className={`font-display text-xl font-bold transition-colors duration-300 ${
                scrolled ? 'text-charcoal-900' : 'text-white'
              }`}>
                {displayName}
              </div>
              <div 
                className="text-xs tracking-[0.2em] transition-colors duration-300"
                style={{ color: primaryColor }}
              >
                {displayTagline}
              </div>
            </div>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a 
              href="#features" 
              className={`text-sm font-medium tracking-wide transition-colors ${
                scrolled ? 'text-charcoal-800' : 'text-white/90'
              }`}
              onMouseEnter={(e) => e.currentTarget.style.color = primaryColor}
              onMouseLeave={(e) => e.currentTarget.style.color = ''}
            >
              Features
            </a>
            <a 
              href="#testimonial" 
              className={`text-sm font-medium tracking-wide transition-colors ${
                scrolled ? 'text-charcoal-800' : 'text-white/90'
              }`}
              onMouseEnter={(e) => e.currentTarget.style.color = primaryColor}
              onMouseLeave={(e) => e.currentTarget.style.color = ''}
            >
              Testimonials
            </a>
            <Link 
              href="/dashboard" 
              className={`px-6 py-2.5 text-sm font-medium tracking-wide border-2 transition-all duration-300 ${
                scrolled 
                  ? 'hover:text-white' 
                  : 'border-white/80 text-white hover:bg-white hover:text-charcoal-900'
              }`}
              style={scrolled ? { borderColor: primaryColor, color: primaryColor } : undefined}
              onMouseEnter={(e) => { if (scrolled) { e.currentTarget.style.backgroundColor = primaryColor; e.currentTarget.style.color = 'white'; }}}
              onMouseLeave={(e) => { if (scrolled) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = primaryColor; }}}
              data-testid="link-dashboard"
            >
              Enter Platform
            </Link>
          </div>

          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden ${scrolled ? 'text-charcoal-900' : 'text-white'}`}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white shadow-xl py-6 px-6 space-y-4">
            <a href="#features" className="block text-charcoal-800 font-medium py-2">Features</a>
            <a href="#testimonial" className="block text-charcoal-800 font-medium py-2">Testimonials</a>
            <Link 
              href="/dashboard" 
              className="block text-white py-3 px-4 text-center font-medium"
              style={{ backgroundColor: primaryColor }}
            >
              Enter Platform
            </Link>
          </div>
        )}
      </nav>
      <section ref={heroRef} className="min-h-screen flex items-center justify-center relative overflow-hidden pt-20">
        <div 
          className="absolute inset-0"
          style={{ background: `linear-gradient(to bottom right, #1f2937, ${primaryColor}, #374151)` }}
        />
        
        <div 
          className="absolute inset-0 opacity-[0.08] mix-blend-luminosity"
          style={{
            backgroundImage: `url(${constructionBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'grayscale(100%) contrast(1.1)'
          }}
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-800/80 via-transparent to-charcoal-800/50" />
        
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        
        <div 
          className="absolute top-1/4 -left-20 w-96 h-96 rounded-full blur-3xl"
          style={{ backgroundColor: `${primaryColor}20` }}
        />
        <div 
          className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full blur-3xl"
          style={{ backgroundColor: `${primaryColor}15` }}
        />
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 text-center">
          <h1 className="animate-in font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
            The Forge of Winning Proposals.
          </h1>
          
          <p className="animate-in text-xl md:text-2xl lg:text-3xl text-gray-200 mb-8 max-w-4xl mx-auto leading-relaxed font-medium">
            Transform your company's collective intelligence into persuasive, compliant, and winning bids—instantly.
          </p>
          
          <div className="animate-in text-base md:text-lg text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed font-light space-y-4 text-left">
            <p>
              In the high-stakes world of B2B sales, the RFP is the gatekeeper. Yet, for too long, navigating this gate has been a soul-crushing exercise in manual labor that forces you to compromise. It has forced growth teams to choose between speed and quality, and it has buried the competitive edge of enterprises under a mountain of spreadsheets.
            </p>
            <p className="font-semibold text-white text-center">
              The era of manual bidding is over. The era of the Forge has begun.
            </p>
            <p>
              BidForge AI is the "Iron Man Suit" for the ambitious challenger and the "Revenue Engine" for the global incumbent. We combine the generative power of advanced Artificial Intelligence with the rigorous precision of enterprise search to automate the proposal process. We don't just fill out forms; we construct winning arguments, anchored in the truth of your organization's expertise.
            </p>
          </div>
          
          <div className="animate-in flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/dashboard" 
              className="group px-10 py-5 text-white font-semibold text-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 inline-flex items-center justify-center gap-2"
              style={{ background: primaryColor }}
              data-testid="button-start"
            >
              Start Building Bids
              <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
            </Link>
            
            <a 
              href="#features" 
              className="px-10 py-5 border-2 font-semibold text-lg transition-all duration-300"
              style={{ borderColor: `${primaryColor}80`, color: primaryColor }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${primaryColor}15`; e.currentTarget.style.borderColor = primaryColor; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = `${primaryColor}80`; }}
            >
              Explore Features
            </a>
          </div>
        </div>
        
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <div 
            className="w-6 h-10 border-2 rounded-full flex justify-center pt-2"
            style={{ borderColor: `${primaryColor}80` }}
          >
            <div 
              className="w-1 h-3 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
          </div>
        </div>
      </section>
      <section className="py-20 bg-charcoal-900 border-y border-charcoal-700">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div 
                  className="text-4xl md:text-5xl font-display font-bold mb-2"
                  style={{ color: primaryColor }}
                >
                  {stat.value}
                </div>
                <div className="text-gray-400 text-sm uppercase tracking-wider">
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
              Core Capabilities
            </span>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Built for Winning
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Every feature designed to give you an unfair advantage in construction bidding.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group bg-card p-8 lg:p-10 border border-border hover:shadow-2xl transition-all duration-500 hover:-translate-y-1"
                style={{ ['--hover-border-color' as string]: primaryColor }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = primaryColor)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
                data-testid={`card-feature-${index}`}
              >
                <div 
                  className="w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: primaryColor }}
                >
                  <feature.icon className="text-white" size={28} />
                </div>
                
                <h3 className="font-display text-xl lg:text-2xl font-semibold text-foreground mb-4">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {feature.description}
                </p>
                
                <div className="pt-6 border-t border-border">
                  <div 
                    className="text-3xl lg:text-4xl font-bold mb-1"
                    style={{ color: primaryColor }}
                  >
                    {feature.stat}
                  </div>
                  <div className="text-sm text-muted-foreground uppercase tracking-wider">
                    {feature.statLabel}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="testimonial" className="py-24 md:py-32 bg-charcoal-900 text-white relative overflow-hidden">
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
          
          <div className="pt-8 border-t border-charcoal-700 inline-block">
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

      <footer className="bg-charcoal-900 border-t border-charcoal-800 py-16">
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
          <div className="pt-8 border-t border-charcoal-800 flex flex-col md:flex-row justify-between items-center gap-4">
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
