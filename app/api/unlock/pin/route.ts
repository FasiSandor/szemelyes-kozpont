import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/neon/session";
import { sql } from "@/lib/neon/db";\nimport { issueUnlock, type UnlockScope } from "@/lib/unlock/session";

function pinHash(pin:string,salt:string){
  return scryptSync(pin,salt,64).toString("hex");
}
function validPin(pin:string){
  return /^\d{6}$/.test(pin);
}
export async function POST(request:Request){
  try{
    const user=await requireUser();
    const body=await request.json() as {action?:"set"|"verify";pin?:string;scope?:UnlockScope};
    const pin=body.pin??"";\n    const scope:UnlockScope=body.scope==="vault"?"vault":"app";
    if(!validPin(pin)) return Response.json({error:"A kód pontosan 6 számjegy legyen."},{status:400});
    const db=sql();

    if(body.action==="set"){
      const salt=randomBytes(16).toString("hex");
      const hash=pinHash(pin,salt);
      await db`
        insert into app_unlock_pins(user_id,pin_salt,pin_hash,failed_attempts,locked_until,updated_at)
        values(${user.id},${salt},${hash},0,null,now())
        on conflict(user_id) do update set
          pin_salt=excluded.pin_salt,
          pin_hash=excluded.pin_hash,
          failed_attempts=0,
          locked_until=null,
          updated_at=now()
      `;
      await issueUnlock(user.id,scope);
      return Response.json({ok:true});
    }

    const rows=await db`select pin_salt,pin_hash,failed_attempts,locked_until from app_unlock_pins where user_id=${user.id} limit 1`;
    const row=rows[0] as {pin_salt:string;pin_hash:string;failed_attempts:number;locked_until:Date|null}|undefined;
    if(!row) return Response.json({error:"Még nincs beállítva alkalmazáskód."},{status:404});
    if(row.locked_until && new Date(row.locked_until)>new Date()) return Response.json({error:"Túl sok hibás próbálkozás. Próbáld később."},{status:429});

    const actual=Buffer.from(pinHash(pin,row.pin_salt),"hex");
    const expected=Buffer.from(row.pin_hash,"hex");
    const ok=actual.length===expected.length && timingSafeEqual(actual,expected);
    if(!ok){
      const next=(row.failed_attempts??0)+1;
      await db`
        update app_unlock_pins
        set failed_attempts=${next},
            locked_until=case when ${next}>=5 then now()+interval '5 minutes' else null end,
            updated_at=now()
        where user_id=${user.id}
      `;
      return Response.json({error:next>=5?"5 hibás próbálkozás. 5 percre zárolva.":"Hibás kód.",attempts:next},{status:401});
    }

    await db`update app_unlock_pins set failed_attempts=0,locked_until=null,updated_at=now() where user_id=${user.id}`;
    await issueUnlock(user.id,scope);
    return Response.json({ok:true});
  }catch(error){
    if(error instanceof Error && error.message==="UNAUTHORIZED") return Response.json({error:"Nincs bejelentkezve."},{status:401});
    return Response.json({error:"Nem sikerült az alkalmazás feloldása."},{status:500});
  }
}
