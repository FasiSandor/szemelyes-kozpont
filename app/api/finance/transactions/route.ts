import { getOrCreateHousehold } from "@/lib/neon/household";
import { sql } from "@/lib/neon/db";

type IncomingTransaction={
  externalId?:string;
  bookedAt:string;
  amountHuf:number;
  merchant?:string;
  description?:string;
  category?:string;
  isBusiness?:boolean;
};

function normalizeText(value:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}

function classifyMerchant(merchant:string,description:string){
  const t=normalizeText((merchant+" "+description).trim());
  if(!t) return merchant||"Ismeretlen";
  const map:[RegExp,string][]=[
    [/lidl/,"Lidl"],[/penny/,"Penny"],[/tesco/,"Tesco"],[/aldi/,"Aldi"],[/spar|interspar/,"SPAR"],
    [/mol\b/,"MOL"],[/shell/,"Shell"],[/omv/,"OMV"],[/apple\.com|apple /,"Apple"],
    [/mcdonald|meki/,"McDonald's"],[/gyongy|alma patika|kamilla.*patika|gyogyszertar|patika/,"Gyógyszertár"],
    [/dm drogerie|\bdm\b/,"dm"],[/rossmann/,"Rossmann"],[/ikea/,"IKEA"],[/jysk/,"JYSK"],
    [/obi\b/,"OBI"],[/praktiker/,"Praktiker"],[/decathlon/,"Decathlon"]
  ];
  for(const [re,label] of map) if(re.test(t)) return label;
  return merchant?.trim()||description?.trim().slice(0,40)||"Ismeretlen";
}

function classifyCategory(amount:number,merchant:string,description:string){
  if(amount>0) return "Egyéb bevétel";
  const t=normalizeText((merchant+" "+description).trim());
  if(/lidl|penny|tesco|aldi|spar|interspar|elelmiszer|coop|cba/.test(t)) return "Élelmiszer";
  if(/mol\b|shell|omv|benz|uzemanyag|tankol/.test(t)) return "Üzemanyag";
  if(/eon|mvm|vizmu|tavho|gaz|aram|rezsi/.test(t)) return "Rezsi";
  if(/netflix|spotify|youtube|icloud|apple\.com|google|subscription|elofizetes/.test(t)) return "Előfizetések";
  if(/patika|gyogyszertar|egeszseg|orvos|fogasz/.test(t)) return "Egészség";
  if(/etterem|restaurant|burger|pizza|mcdonald|kfc|wolt|foodora/.test(t)) return "Étkezés";
  if(/parkol|autopalya|biztositas|szerviz|auto|gumi/.test(t)) return "Autó";
  if(/ikea|jysk|obi|praktiker|decathlon|rossmann|\bdm\b/.test(t)) return "Vásárlás";
  if(/nav|ado|jarulek/.test(t)) return "Adó / NAV";
  if(/atutalas|utalas|transfer/.test(t)) return "Átutalás";
  return "Egyéb kiadás";
}

export async function GET(request:Request){
  try{
    const {household}=await getOrCreateHousehold();
    const {searchParams}=new URL(request.url);
    const month=searchParams.get("month")||new Date().toISOString().slice(0,7);
    const from=month+"-01";
    const next=new Date(from+"T00:00:00Z");
    next.setUTCMonth(next.getUTCMonth()+1);
    const to=next.toISOString().slice(0,10);
    const db=sql();

    const rows=await db`
      select id,external_id,booked_at,amount_huf,merchant,description,category,is_business,created_at
      from bank_transactions
      where household_id=${household.id}
        and booked_at>=${from}
        and booked_at<${to}
      order by booked_at desc,created_at desc
      limit 500
    `;

    const totals=await db`
      select
        coalesce(sum(amount_huf) filter (where amount_huf>0),0)::bigint as income_huf,
        coalesce(sum(abs(amount_huf)) filter (where amount_huf<0),0)::bigint as expense_huf,
        count(*)::int as count
      from bank_transactions
      where household_id=${household.id}
        and booked_at>=${from}
        and booked_at<${to}
    `;

    const categoryRows=await db`
      select coalesce(nullif(category,''),'Egyéb kiadás') as name,
             coalesce(sum(abs(amount_huf)),0)::bigint as amount_huf,
             count(*)::int as count
      from bank_transactions
      where household_id=${household.id}
        and booked_at>=${from}
        and booked_at<${to}
        and amount_huf<0
      group by 1
      order by amount_huf desc
    `;

    const merchantRows=await db`
      select coalesce(nullif(merchant,''),'Ismeretlen') as name,
             coalesce(sum(abs(amount_huf)),0)::bigint as amount_huf,
             count(*)::int as count
      from bank_transactions
      where household_id=${household.id}
        and booked_at>=${from}
        and booked_at<${to}
        and amount_huf<0
      group by 1
      order by amount_huf desc
      limit 12
    `;

    const incomeRows=await db`
      select coalesce(nullif(category,''),'Egyéb bevétel') as name,
             coalesce(sum(amount_huf),0)::bigint as amount_huf,
             count(*)::int as count
      from bank_transactions
      where household_id=${household.id}
        and booked_at>=${from}
        and booked_at<${to}
        and amount_huf>0
      group by 1
      order by amount_huf desc
    `;

    return Response.json({
      month,
      totals:totals[0],
      transactions:rows,
      categories:categoryRows,
      merchants:merchantRows,
      incomeBreakdown:incomeRows
    });
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED") return Response.json({error:"Nincs bejelentkezve."},{status:401});
    return Response.json({error:"Nem sikerült betölteni a tranzakciókat."},{status:500});
  }
}

export async function POST(request:Request){
  try{
    const {household,user}=await getOrCreateHousehold();
    const body=await request.json() as {source?:string;transactions?:IncomingTransaction[]};
    const txs=Array.isArray(body.transactions)?body.transactions:[];
    if(!txs.length) return Response.json({error:"Nincs importálható tranzakció."},{status:400});

    const db=sql();
    const dates=txs.map(x=>x.bookedAt).filter(Boolean).sort();
    const importRows=await db`
      insert into bank_imports(household_id,source,period_start,period_end,imported_by_user_id)
      values(${household.id},${body.source||"manual-import"},${dates[0]||null},${dates.at(-1)||null},${user.id})
      returning id
    `;
    const importId=importRows[0].id as string;

    let inserted=0,skipped=0;
    for(const tx of txs){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(tx.bookedAt)||!Number.isFinite(Number(tx.amountHuf))){skipped++;continue;}
      const description=String(tx.description||"").trim();
      const merchant=classifyMerchant(String(tx.merchant||""),description);
      const amount=Math.round(Number(tx.amountHuf));
      const category=tx.category?.trim()||classifyCategory(amount,merchant,description);
      const externalId=tx.externalId?.trim()||[tx.bookedAt,amount,merchant,description].join("|").slice(0,500);

      const exists=await db`
        select id from bank_transactions
        where household_id=${household.id} and external_id=${externalId}
        limit 1
      `;
      if(exists.length){skipped++;continue;}

      await db`
        insert into bank_transactions(
          household_id,import_id,external_id,booked_at,amount_huf,merchant,description,category,is_business
        ) values(
          ${household.id},${importId},${externalId},${tx.bookedAt},${amount},
          ${merchant},${description||null},${category},${Boolean(tx.isBusiness)}
        )
      `;
      inserted++;
    }

    await db`
      insert into audit_log(household_id,actor_user_id,action,entity_type,entity_id)
      values(${household.id},${user.id},'import','bank_transactions',${importId})
    `;

    return Response.json({ok:true,inserted,skipped,importId});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED") return Response.json({error:"Nincs bejelentkezve."},{status:401});
    return Response.json({error:"Nem sikerült importálni a tranzakciókat."},{status:500});
  }
}
