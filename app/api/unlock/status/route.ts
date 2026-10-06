import { requireUser } from "@/lib/neon/session";
import { sql } from "@/lib/neon/db";
import { hasValidUnlock } from "@/lib/unlock/session";

export async function GET(){
  try{
    const user=await requireUser();
    const db=sql();
    const [pinRows,credRows,appUnlocked,vaultUnlocked]=await Promise.all([
      db`select 1 from app_unlock_pins where user_id=${user.id} limit 1`,
      db`select 1 from app_unlock_credentials where user_id=${user.id} limit 1`,
      hasValidUnlock(user.id,"app"),
      hasValidUnlock(user.id,"vault")
    ]);
    return Response.json({
      authenticated:true,
      hasPin:pinRows.length>0,
      hasBiometric:credRows.length>0,
      appUnlocked,
      vaultUnlocked
    });
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({authenticated:false},{status:401});
    }
    return Response.json({error:"Állapotlekérés sikertelen."},{status:500});
  }
}
