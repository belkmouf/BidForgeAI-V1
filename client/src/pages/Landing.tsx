import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { FileText, Brain, Zap, Shield, Menu, X, ChevronRight, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import constructionBg from '@assets/stock_images/construction_site_bu_f0afb754.jpg';
import bidForgeLogo from '@assets/generated_images/bidforge_ai_premium_logo.png';

import _1764979718 from "@assets/1764979718.png";

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
              src={_1764979718} 
              alt="BidForge AI Logo" 
              className="h-10 w-10 object-contain"
            />
            <div>
              <div className={`font-display text-xl font-bold transition-colors duration-300 ${
                scrolled ? 'text-charcoal-900' : 'text-white'
              }`}>
                BidForge AI
              </div>
              <div className={`text-xs tracking-[0.2em] transition-colors duration-300 ${
                scrolled ? 'text-gold-700' : 'text-gold-400'
              }`}>
                INTELLIGENT BIDDING
              </div>
            </div>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className={`text-sm font-medium tracking-wide hover:text-teal-500 transition-colors ${
              scrolled ? 'text-charcoal-800' : 'text-white/90'
            }`}>
              Features
            </a>
            <a href="#testimonial" className={`text-sm font-medium tracking-wide hover:text-teal-500 transition-colors ${
              scrolled ? 'text-charcoal-800' : 'text-white/90'
            }`}>
              Testimonials
            </a>
            <Link 
              href="/dashboard" 
              className={`px-6 py-2.5 text-sm font-medium tracking-wide border-2 transition-all duration-300 ${
                scrolled 
                  ? 'border-teal-700 text-teal-700 hover:bg-teal-700 hover:text-white' 
                  : 'border-white/80 text-white hover:bg-white hover:text-charcoal-900'
              }`}
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
            <Link href="/dashboard" className="block bg-teal-700 text-white py-3 px-4 text-center font-medium">
              Enter Platform
            </Link>
          </div>
        )}
      </nav>
      <section ref={heroRef} className="min-h-screen flex items-center justify-center relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-gradient-to-br from-charcoal-800 via-teal-600 to-charcoal-700" />
        
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
        
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 text-center">
          <div className="animate-in mb-6">
            <span className="text-gold-400 uppercase tracking-[0.25em] text-sm font-medium">
              Intelligent Bidding Platform
            </span>
          </div>
          
          <h1 className="animate-in font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-8 leading-[1.1] tracking-tight">
            Win More Bids.<br />
            <span className="text-gold-400">Work Less.</span>
          </h1>
          
          <p className="animate-in text-lg md:text-xl lg:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
            BidForge AI learns from your past successes to generate winning proposals. 
            Sophisticated automation for serious construction professionals.
          </p>
          
          <div className="animate-in flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/dashboard" 
              className="group px-10 py-5 bg-gradient-to-r from-teal-700 to-teal-600 text-white font-semibold text-lg hover:shadow-2xl hover:shadow-teal-500/25 transition-all duration-300 hover:scale-105 inline-flex items-center justify-center gap-2"
              data-testid="button-start"
            >
              Start Building Bids
              <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
            </Link>
            
            <a 
              href="#features" 
              className="px-10 py-5 border-2 border-gold-500/50 text-gold-400 font-semibold text-lg hover:bg-gold-500/10 hover:border-gold-400 transition-all duration-300"
            >
              Explore Features
            </a>
          </div>
        </div>
        
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-gold-500/50 rounded-full flex justify-center pt-2">
            <div className="w-1 h-3 bg-gold-400 rounded-full" />
          </div>
        </div>
      </section>
      <section className="py-20 bg-charcoal-900 border-y border-charcoal-700">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-display font-bold text-gold-400 mb-2">
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
            <span className="text-teal-700 uppercase tracking-[0.2em] text-sm font-medium mb-4 block">
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
                className="group bg-card p-8 lg:p-10 border border-border hover:shadow-2xl transition-all duration-500 hover:border-teal-700 hover:-translate-y-1"
                data-testid={`card-feature-${index}`}
              >
                <div className="w-14 h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-teal-700 to-teal-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="text-white" size={28} />
                </div>
                
                <h3 className="font-display text-xl lg:text-2xl font-semibold text-foreground mb-4">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {feature.description}
                </p>
                
                <div className="pt-6 border-t border-border">
                  <div className="text-3xl lg:text-4xl font-bold text-teal-700 mb-1">
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
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-500 via-transparent to-transparent" />
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="font-accent text-gold-400 text-7xl md:text-8xl mb-8 leading-none">"</div>
          
          <blockquote className="text-xl md:text-2xl lg:text-3xl font-light leading-relaxed mb-10 text-gray-300">
            BidForge transformed our bidding process. We went from spending 
            <span className="text-white font-medium"> 3 days per proposal </span>
            to generating comprehensive, winning bids in 
            <span className="text-gold-400 font-medium"> under an hour</span>.
            Our win rate increased by 40%.
          </blockquote>
          
          <div className="pt-8 border-t border-charcoal-700 inline-block">
            <div className="font-medium text-lg text-white mb-1">
              Sarah Mitchell
            </div>
            <div className="text-gold-500 text-sm tracking-wider">
              Director of Operations, Apex Construction Ltd.
            </div>
          </div>
        </div>
      </section>
      <section className="py-24 md:py-32 bg-gradient-to-br from-teal-900 to-charcoal-900 relative overflow-hidden">
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
            className="group inline-flex items-center gap-3 px-12 py-6 bg-gold-600 text-charcoal-900 font-bold text-lg hover:bg-gold-500 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-gold-500/25"
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
                  src={_1764979718} 
                  alt="BidForge AI Logo" 
                  className="h-8 w-8 object-contain"
                />
                <span className="font-display text-xl font-bold text-white">BidForge AI</span>
              </div>
              <p className="text-gray-400 max-w-md leading-relaxed">
                The intelligent bidding platform that learns from your wins to create better proposals, faster.
              </p>
            </div>
            <div>
              <h4 className="font-display font-semibold text-white mb-4">Platform</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#features" className="hover:text-teal-400 transition-colors">Features</a></li>
                <li><Link href="/dashboard" className="hover:text-teal-400 transition-colors">Dashboard</Link></li>
                <li><Link href="/templates" className="hover:text-teal-400 transition-colors">Templates</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-teal-400 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-charcoal-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} BidForge AI. All rights reserved.
            </p>
            <p className="text-gray-600 text-sm">
              Built for construction professionals who refuse to lose.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
