import { getOrCreateHousehold } from "@/lib/neon/household";
import { sql } from "@/lib/neon/db";
import { syncEnableBanking } from "@/lib/openbanking/enablebanking-sync";

export async function POST(){
  try{
    const {household}=await getOrCreateHousehold();
    const db=sql();
    const rows=await db`
      select requisition_id,account_ids from bank_connections
      where household_id=${household.id} and provider='enablebanking' and status='AUTHORIZED'
      limit 1
    `;
    if(!rows.length)return Response.json({error:"Nincs aktív OTP kapcsolat."},{status:404});
    const sessionId=String(rows[0].requisition_id||"");
    const accountIds=Array.isArray(rows[0].account_ids)?rows[0].account_ids:[];
    const result=await syncEnableBanking({householdId:household.id,sessionId,accountIds});
    return Response.json({ok:true,...result});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return Response.json({error:"Nincs bejelentkezve."},{status:401});
    return Response.json({error:error instanceof Error?error.message:"Az OTP szinkron nem sikerült."},{status:500});
  }
}
