import { currentUser } from "@clerk/nextjs/server";

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

    // Check 2: Allowed Admin Emails
    const adminEmailsRaw = process.env.ADMIN_USER_EMAILS || process.env.NEXT_PUBLIC_ADMIN_USER_EMAILS || "";
    const adminEmails = adminEmailsRaw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (adminEmails.length > 0) {
      const userEmails = user.emailAddresses.map((e) => e.emailAddress.toLowerCase());
      return userEmails.some((email) => adminEmails.includes(email));
    }

    // Default: allow access if no specific email filter configured yet, or protect with UI security gate
    return true;
  } catch {
    return false;
  }
}
