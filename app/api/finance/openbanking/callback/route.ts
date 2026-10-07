import { getOrCreateHousehold } from "@/lib/neon/household";
import { sql } from "@/lib/neon/db";
import { gcRequest } from "@/lib/openbanking/gocardless";
import { syncBankConnection } from "@/lib/openbanking/sync";

export async function GET(request:Request){
  try{
    const {household}=await getOrCreateHousehold();
    const url=new URL(request.url);
    const reference=url.searchParams.get("ref");
    if(!reference)return Response.redirect(new URL("/?open=finance&bank=error",url.origin));

    const db=sql();
    const rows=await db`
      select requisition_id from bank_connections
      where household_id=${household.id} and reference=${reference}
      limit 1
    `;
    const requisitionId=rows[0]?.requisition_id as string|undefined;
    if(!requisitionId)return Response.redirect(new URL("/?open=finance&bank=missing",url.origin));

    const req=await gcRequest("/requisitions/"+requisitionId+"/");
    await db`
      update bank_connections
      set status=${String(req.status||"LN")},
          account_ids=${JSON.stringify(req.accounts||[])}::jsonb,
          updated_at=now()
      where household_id=${household.id} and requisition_id=${requisitionId}
    `;

    if(Array.isArray(req.accounts)&&req.accounts.length){
      await syncBankConnection({householdId:household.id,requisitionId});
    }

    return Response.redirect(new URL("/?open=finance&bank=connected",url.origin));
  }catch{
    const origin=new URL(request.url).origin;
    return Response.redirect(new URL("/?open=finance&bank=error",origin));
  }
}
