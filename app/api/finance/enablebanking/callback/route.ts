import { getOrCreateHousehold } from "@/lib/neon/household";
import { sql } from "@/lib/neon/db";
import { ebRequest } from "@/lib/openbanking/enablebanking";
import { syncEnableBanking } from "@/lib/openbanking/enablebanking-sync";

export async function GET(request:Request){
  const url=new URL(request.url);
  try{
    const {household}=await getOrCreateHousehold();
    const code=url.searchParams.get("code");
    const state=url.searchParams.get("state");
    const error=url.searchParams.get("error");
    if(error||!code||!state)return Response.redirect(new URL("/?open=finance&bank=error",url.origin));

    const db=sql();
    const rows=await db`
      select id from bank_connections
      where household_id=${household.id} and provider='enablebanking' and reference=${state}
      limit 1
    `;
    if(!rows.length)return Response.redirect(new URL("/?open=finance&bank=state",url.origin));

    const session=await ebRequest("/sessions",{method:"POST",body:JSON.stringify({code})});
    const accountIds=(session.accounts||[]).map((a:any)=>a.uid).filter(Boolean);

    await db`
      update bank_connections
      set requisition_id=${String(session.session_id||"")},
          status='AUTHORIZED',
          account_ids=${JSON.stringify(accountIds)}::jsonb,
          consent_expires_at=${session.access?.valid_until||null},
          last_error=null,
          updated_at=now()
      where household_id=${household.id} and provider='enablebanking' and reference=${state}
    `;

    await syncEnableBanking({householdId:household.id,sessionId:String(session.session_id),accountIds});
    return Response.redirect(new URL("/?open=finance&bank=connected",url.origin));
  }catch{
    return Response.redirect(new URL("/?open=finance&bank=error",url.origin));
  }
}
