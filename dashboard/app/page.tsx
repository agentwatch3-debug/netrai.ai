import { LandingNavbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/hero";
import { BentoGrid } from "@/components/landing/bento-grid";
import { ComparisonMatrix } from "@/components/landing/comparison-matrix";
import { CostCalculator } from "@/components/landing/cost-calculator";
import { CTASection } from "@/components/landing/cta-section";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 selection:bg-blue-600 selection:text-white relative">
      {/* Background Subtle Radial Grid Pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* Floating Glassmorphic Navbar */}
      <LandingNavbar />

      {/* Hero Section with Interactive Live Simulator & Code Switcher */}
      <main className="space-y-6">
        <LandingHero />
        <BentoGrid />
        <ComparisonMatrix />
        <CostCalculator />
        <CTASection />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 text-center text-xs font-mono text-slate-500 space-y-2">
        <p>AgentWatch © 2026. Open-Source Multi-Agent Observability & Governance Engine.</p>
        <p className="text-[11px] text-slate-600">
          SOC 2 Type II • HIPAA Ready • SHA-256 Tamper-Evident • Model Context Protocol (MCP) Compatible
        </p>
      </footer>
    </div>
  );
}
