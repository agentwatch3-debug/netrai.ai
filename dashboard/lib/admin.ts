import { currentUser } from "@clerk/nextjs/server";

const DEFAULT_SUPERADMIN_EMAILS = ["agentwatch3@gmail.com"];

export async function isSuperAdmin(): Promise<boolean> {
  if (!process.env.CLERK_SECRET_KEY) {
    return true; // Local dev mode without Clerk credentials
  }

  try {
    const user = await currentUser();
    if (!user) return false;

    // Check 1: Role in Clerk metadata
    const role = (user.publicMetadata as { role?: string })?.role;
    if (role === "admin" || role === "superadmin" || role === "owner") {
      return true;
    }

    // Check 2: Allowed Admin Emails (from Environment Variable + Default SuperAdmin)
    const adminEmailsRaw = process.env.ADMIN_USER_EMAILS || process.env.NEXT_PUBLIC_ADMIN_USER_EMAILS || "";
    const customAdminEmails = adminEmailsRaw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const allowedEmails = new Set([...DEFAULT_SUPERADMIN_EMAILS, ...customAdminEmails]);

    const userEmails = user.emailAddresses.map((e) => e.emailAddress.toLowerCase());
    return userEmails.some((email) => allowedEmails.has(email));
  } catch {
    return false;
  }
}
