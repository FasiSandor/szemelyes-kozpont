import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@/lib/neon/db";

export type UnlockScope = "app" | "vault";

export async function issueUnlock(userId:string, scope:UnlockScope="app"){
  const seconds=scope==="vault"?300:1800;
  const raw=randomBytes(32).toString("base64url");
  const hash=createHash("sha256").update(raw).digest("hex");
  const db=sql();

  await db`delete from app_unlock_sessions where (user_id=${userId} and scope=${scope}) or expires_at < now()`;
  await db`
    insert into app_unlock_sessions(user_id,token_hash,expires_at,scope)
    values(${userId},${hash},now() + (${seconds} * interval '1 second'),${scope})
  `;

  const jar=await cookies();
  jar.set(scope==="vault"?"vault_unlock_token":"app_unlock_token",raw,{
    httpOnly:true,
    secure:process.env.NODE_ENV==="production",
    sameSite:"strict",
    path:"/",
    maxAge:seconds,
  });
}

export async function hasValidUnlock(userId:string, scope:UnlockScope="app"){
  const jar=await cookies();
  const raw=jar.get(scope==="vault"?"vault_unlock_token":"app_unlock_token")?.value;
  if(!raw) return false;

  const hash=createHash("sha256").update(raw).digest("hex");
  const db=sql();
  const rows=await db`
    select 1
    from app_unlock_sessions
    where user_id=${userId}
      and scope=${scope}
      and token_hash=${hash}
      and expires_at>now()
    limit 1
  `;
  return rows.length>0;
}
