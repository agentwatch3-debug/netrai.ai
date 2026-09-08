import { PromptsManager } from "@/components/prompts-manager";

export default function PromptsPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Prompt Management & Version Control</h1>
        <p className="mt-1 text-xs text-inkDim">
          Create, test, version, and promote prompt templates across development, staging, and production environments.
        </p>
      </div>
      <PromptsManager />
    </div>
  );
}
