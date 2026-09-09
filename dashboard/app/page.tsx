import { LandingNavbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/hero";
import { BentoGrid } from "@/components/landing/bento-grid";
import { ComparisonMatrix } from "@/components/landing/comparison-matrix";
import { CostCalculator } from "@/components/landing/cost-calculator";
import { CTASection } from "@/components/landing/cta-section";

export default function Home() {
  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-accent selection:text-white font-sans relative">
      {/* Background Subtle Editorial Grid Pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#E4E2DC40_1px,transparent_1px),linear-gradient(to_bottom,#E4E2DC40_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* Editorial Navbar */}
      <LandingNavbar />

      {/* Main Landing Sections */}
      <main className="space-y-6">
        <LandingHero />
        <BentoGrid />
        <ComparisonMatrix />
        <CostCalculator />
        <CTASection />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-12 text-center text-xs font-mono text-inkDim space-y-2 mt-12">
        <p className="text-ink font-semibold">NetrAI © 2026. Open-Source Multi-Agent Observability & Governance Engine.</p>
        <p className="text-[11px] text-inkDim">
          SHA-256 Tamper-Evident Audit Chains • Model Context Protocol (MCP) Compatible
        </p>
        <p className="text-[10px] text-inkFaint max-w-xl mx-auto pt-1">
          Compliance Notice: NetrAI provides tooling designed to support DPDP, SOC 2, and HIPAA compliance workflows. NetrAI itself has not completed SOC 2 or HIPAA certification at this time.
        </p>
      </footer>
    </div>
  );
}
