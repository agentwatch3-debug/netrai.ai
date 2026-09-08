import "./globals.css";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = { title: "NetrAI", description: "AI Agent Observability, Security & Governance Platform" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const content = <html lang="en" className="bg-paper text-ink antialiased"><body>{children}</body></html>;
  if (publishableKey) {
    return <ClerkProvider publishableKey={publishableKey}>{content}</ClerkProvider>;
  }
  return content;
}
