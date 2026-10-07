import { getOrCreateHousehold } from "@/lib/neon/household";
import { sql } from "@/lib/neon/db";
import { gcRequest,openBankingConfigured,OTP_HU_INSTITUTION } from "@/lib/openbanking/gocardless";

export async function GET(){
  try{
    const {household}=await getOrCreateHousehold();
    const db=sql();
    const rows=await db`
      select id,provider,institution_id,requisition_id,status,account_ids,consent_expires_at,last_sync_at,last_error,created_at,updated_at
      from bank_connections
      where household_id=${household.id} and provider='gocardless' and institution_id=${OTP_HU_INSTITUTION}
      limit 1
    `;
    return Response.json({
      configured:openBankingConfigured(),
      connection:rows[0]||null
    });
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return Response.json({error:"Nincs bejelentkezve."},{status:401});
    return Response.json({error:"Nem sikerült betölteni a bankkapcsolatot."},{status:500});
  }
}

export async function POST(request:Request){
  try{
    const {household}=await getOrCreateHousehold();
    if(!openBankingConfigured())return Response.json({error:"Az Open Banking kulcsok még nincsenek beállítva."},{status:503});

    const reference=crypto.randomUUID();
    const origin=new URL(request.url).origin;
    const redirect=`${origin}/api/finance/openbanking/callback?ref=${encodeURIComponent(reference)}`;

    const requisition=await gcRequest("/requisitions/",{
      method:"POST",
      body:JSON.stringify({
        redirect,
        institution_id:OTP_HU_INSTITUTION,
        reference,
        user_language:"HU",
        account_selection:true,
        redirect_immediate:true
      })
    });

    const db=sql();
    await db`
      insert into bank_connections(
        household_id,provider,institution_id,requisition_id,reference,status,account_ids,updated_at
      ) values(
        ${household.id},'gocardless',${OTP_HU_INSTITUTION},${requisition.id},${reference},
        ${String(requisition.status||"CR")},'[]'::jsonb,now()
      )
      on conflict (household_id,provider,institution_id)
      do update set
        requisition_id=excluded.requisition_id,
        reference=excluded.reference,
        status=excluded.status,
        account_ids='[]'::jsonb,
        last_error=null,
        updated_at=now()
    `;

    return Response.json({ok:true,link:requisition.link,requisitionId:requisition.id});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return Response.json({error:"Nincs bejelentkezve."},{status:401});
    return Response.json({error:error instanceof Error?error.message:"Nem sikerült elindítani az OTP kapcsolatot."},{status:500});
  }
}
