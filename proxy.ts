import { createServerAuth } from "@/lib/neon/auth-server";

const auth=createServerAuth();

export default auth.middleware({
  loginUrl:"/auth/sign-in",
});

export const config={
  matcher:["/"],
};
