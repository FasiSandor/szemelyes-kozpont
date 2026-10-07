import { getOrCreateHousehold } from "@/lib/neon/household";
import { sql } from "@/lib/neon/db";
import { ebRequest,enableBankingConfigured,findOtpHungary } from "@/lib/openbanking/enablebanking";

export async function GET(){
  try{
    const {household}=await getOrCreateHousehold();
    const db=sql();
    const rows=await db`
      select id,provider,institution_id,requisition_id,status,account_ids,consent_expires_at,last_sync_at,last_error,created_at,updated_at
      from bank_connections
      where household_id=${household.id} and provider='enablebanking'
      limit 1
    `;
    return Response.json({configured:enableBankingConfigured(),connection:rows[0]||null});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return Response.json({error:"Nincs bejelentkezve."},{status:401});
    return Response.json({error:"Nem sikerült betölteni a bankkapcsolatot."},{status:500});
  }
}

export async function POST(request:Request){
  try{
    const {household}=await getOrCreateHousehold();
    if(!enableBankingConfigured())return Response.json({error:"Az Enable Banking alkalmazáskulcs még nincs beállítva."},{status:503});

    const otp=await findOtpHungary();
    const state=crypto.randomUUID();
    const origin=new URL(request.url).origin;
    const redirect_url=origin+"/api/finance/enablebanking/callback";
    const maxSeconds=Math.max(3600,Math.min(Number(otp.maximum_consent_validity||7776000),7776000));
    const validUntil=new Date(Date.now()+maxSeconds*1000).toISOString();

    const auth=await ebRequest("/auth",{
      method:"POST",
      body:JSON.stringify({
        access:{balances:true,transactions:true,valid_until:validUntil},
        aspsp:{name:otp.name,country:"HU"},
        state,
        redirect_url,
        psu_type:"personal",
        language:"hu"
      })
    });

    const db=sql();
    await db`
      insert into bank_connections(
        household_id,provider,institution_id,requisition_id,reference,status,account_ids,consent_expires_at,updated_at
      ) values(
        ${household.id},'enablebanking',${String(otp.name)},${String(auth.authorization_id||"")},
        ${state},'PENDING_AUTHORIZATION','[]'::jsonb,${validUntil},now()
      )
      on conflict (household_id,provider,institution_id)
      do update set
        requisition_id=excluded.requisition_id,
        reference=excluded.reference,
        status=excluded.status,
        account_ids='[]'::jsonb,
        consent_expires_at=excluded.consent_expires_at,
        last_error=null,
        updated_at=now()
    `;

    return Response.json({ok:true,url:auth.url});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return Response.json({error:"Nincs bejelentkezve."},{status:401});
    return Response.json({error:error instanceof Error?error.message:"Nem sikerült elindítani az OTP kapcsolatot."},{status:500});
  }
}
