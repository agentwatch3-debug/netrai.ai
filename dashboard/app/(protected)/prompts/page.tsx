import { PromptsManager } from "@/components/prompts-manager";

export default function PromptsPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Prompt Management & Version Control</h1>
        <p className="text-sm text-slate-400">
          Create, test, version, and promote prompt templates across development, staging, and production environments.
        </p>
      </div>
      <PromptsManager />
    </>
  );
}
