import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@/lib/neon/db";

export async function issueUnlock(userId:string){
  const raw=randomBytes(32).toString("base64url");
  const hash=createHash("sha256").update(raw).digest("hex");
  const db=sql();
  await db`delete from app_unlock_sessions where user_id=${userId} or expires_at < now()`;
  await db`insert into app_unlock_sessions(user_id,token_hash,expires_at) values(${userId},${hash},now()+interval '30 minutes')`;
  const jar=await cookies();
  jar.set("app_unlock_token",raw,{
    httpOnly:true,
    secure:process.env.NODE_ENV==="production",
    sameSite:"strict",
    path:"/",
    maxAge:1800,
  });
}

export async function hasValidUnlock(userId:string){
  const jar=await cookies();
  const raw=jar.get("app_unlock_token")?.value;
  if(!raw) return false;
  const hash=createHash("sha256").update(raw).digest("hex");
  const db=sql();
  const rows=await db`select 1 from app_unlock_sessions where user_id=${userId} and token_hash=${hash} and expires_at>now() limit 1`;
  return rows.length>0;
}
