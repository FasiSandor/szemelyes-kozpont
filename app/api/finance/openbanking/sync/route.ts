import { getOrCreateHousehold } from "@/lib/neon/household";
import { sql } from "@/lib/neon/db";
import { OTP_HU_INSTITUTION } from "@/lib/openbanking/gocardless";
import { syncBankConnection } from "@/lib/openbanking/sync";

export async function POST(){
  try{
    const {household}=await getOrCreateHousehold();
    const db=sql();
    const rows=await db`
      select requisition_id from bank_connections
      where household_id=${household.id}
        and provider='gocardless'
        and institution_id=${OTP_HU_INSTITUTION}
      limit 1
    `;
    const requisitionId=rows[0]?.requisition_id as string|undefined;
    if(!requisitionId)return Response.json({error:"Nincs aktív OTP kapcsolat."},{status:404});
    const result=await syncBankConnection({householdId:household.id,requisitionId});
    return Response.json({ok:true,...result});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return Response.json({error:"Nincs bejelentkezve."},{status:401});
    return Response.json({error:error instanceof Error?error.message:"A banki szinkron nem sikerült."},{status:500});
  }
}
