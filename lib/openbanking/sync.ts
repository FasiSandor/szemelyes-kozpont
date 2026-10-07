import { sql } from "@/lib/neon/db";
import { gcRequest } from "@/lib/openbanking/gocardless";

function norm(value:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}
function category(amount:number,merchant:string,description:string){
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

export async function syncBankConnection(args:{householdId:string;requisitionId:string}){
  const req=await gcRequest("/requisitions/"+args.requisitionId+"/");
  const accounts=Array.isArray(req.accounts)?req.accounts:[];
  const db=sql();
  let inserted=0;

  for(const accountId of accounts){
    const response=await gcRequest("/accounts/"+accountId+"/transactions/");
    const booked=response?.transactions?.booked||[];
    for(const tx of booked){
      const amountRaw=tx?.transactionAmount?.amount;
      const currency=String(tx?.transactionAmount?.currency||"").toUpperCase();
      if(currency&&currency!=="HUF")continue;
      const amount=Math.round(Number(amountRaw));
      if(!Number.isFinite(amount))continue;
      const date=String(tx.bookingDate||tx.valueDate||"").slice(0,10);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
      const merchant=String(
        amount<0?(tx.creditorName||tx.merchantName||""):(tx.debtorName||tx.merchantName||"")
      ).trim()||"Banki tranzakció";
      const description=String(
        tx.remittanceInformationUnstructured||
        tx.remittanceInformationUnstructuredArray?.join(" ")||
        tx.additionalInformation||
        ""
      ).trim();
      const externalId="gc:"+accountId+":"+(tx.transactionId||tx.internalTransactionId||[date,amount,merchant,description].join("|"));

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
          ${description||null},${category(amount,merchant,description)},false
        )
      `;
      inserted++;
    }
  }

  await db`
    update bank_connections
    set status=${String(req.status||"LN")},
        account_ids=${JSON.stringify(accounts)}::jsonb,
        last_sync_at=now(),
        last_error=null,
        updated_at=now()
    where household_id=${args.householdId} and requisition_id=${args.requisitionId}
  `;

  return {inserted,accounts,status:req.status};
}
