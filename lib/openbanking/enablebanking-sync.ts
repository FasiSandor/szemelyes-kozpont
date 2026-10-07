import { sql } from "@/lib/neon/db";
import { ebRequest } from "@/lib/openbanking/enablebanking";

function norm(value:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}
function classify(amount:number,merchant:string,description:string){
  if(amount>0)return "Egyéb bevétel";
  const t=norm(merchant+" "+description);
  if(/lidl|penny|tesco|aldi|spar|interspar|coop|cba/.test(t))return "Élelmiszer";
  if(/mol\b|shell|omv|benz|uzemanyag|tankol/.test(t))return "Üzemanyag";
  if(/eon|mvm|vizmu|tavho|gaz|aram|rezsi/.test(t))return "Rezsi";
  if(/netflix|spotify|youtube|icloud|apple\.com|google|subscription|elofizetes/.test(t))return "Előfizetések";
  if(/patika|gyogyszertar|egeszseg|orvos|fogasz/.test(t))return "Egészség";
  if(/etterem|restaurant|burger|pizza|mcdonald|kfc|wolt|foodora/.test(t))return "Étkezés";
  if(/parkol|autopalya|biztositas|szerviz|auto|gumi/.test(t))return "Autó";
  if(/ikea|jysk|obi|praktiker|decathlon|rossmann|\bdm\b/.test(t))return "Vásárlás";
  if(/nav|ado|jarulek/.test(t))return "Adó / NAV";
  return "Egyéb kiadás";
}

export async function syncEnableBanking(args:{householdId:string;sessionId:string;accountIds?:string[]}){
  const db=sql();
  let accountIds=args.accountIds||[];
  if(!accountIds.length){
    const session=await ebRequest("/sessions/"+encodeURIComponent(args.sessionId));
    accountIds=(session.accounts||[]).map((a:any)=>a.uid).filter(Boolean);
  }

  let inserted=0;
  const errors:string[]=[];

  for(const accountId of accountIds){
    let continuation:string|undefined;
    try{
      do{
        const q=new URLSearchParams({transaction_status:"BOOK"});
        if(continuation)q.set("continuation_key",continuation);
        const response=await ebRequest("/accounts/"+encodeURIComponent(accountId)+"/transactions?"+q.toString());
      const txs=Array.isArray(response.transactions)?response.transactions:[];
      for(const tx of txs){
        const currency=String(tx?.transaction_amount?.currency||"").toUpperCase();
        if(currency&&currency!=="HUF")continue;
        const raw=Number(tx?.transaction_amount?.amount);
        if(!Number.isFinite(raw))continue;
        const amount=Math.round(Math.abs(raw)*(String(tx.credit_debit_indicator)==="DBIT"?-1:1));
        const date=String(tx.booking_date||tx.value_date||tx.transaction_date||"").slice(0,10);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;

        const merchant=String(
          amount<0?(tx?.creditor?.name||tx?.creditor_agent?.name||""):(tx?.debtor?.name||tx?.debtor_agent?.name||"")
        ).trim()||"Banki tranzakció";
        const remittance=Array.isArray(tx.remittance_information)?tx.remittance_information.join(" "):String(tx.remittance_information||"");
        const description=[remittance,tx?.bank_transaction_code?.description,tx?.note].filter(Boolean).join(" · ").trim();
        const externalId="eb:"+accountId+":"+(tx.entry_reference||tx.transaction_id||[date,amount,merchant,description].join("|"));

        const exists=await db`
          select id from bank_transactions
          where household_id=${args.householdId} and external_id=${externalId}
          limit 1
        `;
        if(exists.length)continue;

        await db`
          insert into bank_transactions(
            household_id,external_id,booked_at,amount_huf,merchant,description,category,is_business
          ) values(
            ${args.householdId},${externalId},${date},${amount},${merchant},
            ${description||null},${classify(amount,merchant,description)},false
          )
        `;
        inserted++;
      }
        continuation=response.continuation_key||response?.links?.next?.continuation_key||undefined;
      }while(continuation);
    }catch(error){
      errors.push(error instanceof Error?error.message:String(error));
    }
  }

  await db`
    update bank_connections
    set account_ids=${JSON.stringify(accountIds)}::jsonb,
        last_sync_at=now(),
        last_error=${errors.length?errors.join(" | "):null},
        updated_at=now()
    where household_id=${args.householdId} and provider='enablebanking'
  `;
  return {inserted,accounts:accountIds.length,errors};
}
