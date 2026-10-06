import { createServerAuth } from "@/lib/neon/auth-server";

export async function requireUser() {
  const auth=createServerAuth();
  const { data }=await auth.getSession();
  const user=data?.user;
  if(!user?.id) throw new Error("UNAUTHORIZED");
  return user;
}
