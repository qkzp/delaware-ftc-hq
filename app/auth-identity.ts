import { getServerSession } from "next-auth";
import { authOptions, isAuthConfigured } from "../auth";

export type AppUser = {
  userId: string;
};

export async function getCurrentUser(): Promise<AppUser | null> {
  if (!isAuthConfigured()) return null;
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;
  return { userId: id };
}
