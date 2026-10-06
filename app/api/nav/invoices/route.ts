import { getNavAuth, getNavIntegration } from "@/lib/nav/integration";
import { queryIssuedInvoiceDigests } from "@/lib/nav/client";
import { sql } from "@/lib/neon/db";

function dateOnly(d:Date){
  return d.toISOString().slice(0,10);
}

function chunks(from:string,to:string){
  const out:{from:string;to:string}[]=[];
  let cursor=new Date(from+"T00:00:00Z");
  const end=new Date(to+"T00:00:00Z");
  while(cursor<=end){
    const chunkEnd=new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate()+34);
    if(chunkEnd>end) chunkEnd.setTime(end.getTime());
    out.push({from:dateOnly(cursor),to:dateOnly(chunkEnd)});
    cursor=new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate()+1);
  }
  return out;
}

export async function GET(request:Request){
  try{
    const {integration}=await getNavIntegration();
    if(!integration) return Response.json({configured:false,invoices:[],summary:null});
    const {searchParams}=new URL(request.url);
    const year=Number(searchParams.get("year")||new Date().getUTCFullYear());
    const from=searchParams.get("from")||`${year}-01-01`;
    const to=searchParams.get("to")||`${year}-12-31`;
    const q=(searchParams.get("q")||"").trim();
    const db=sql();

    const rows=q
      ? await db`
          select *
          from invoices
          where business_id=${integration.business_id}
            and issue_date between ${from} and ${to}
            and (
              coalesce(invoice_number,'') ilike ${"%"+q+"%"}
              or coalesce(partner_name,'') ilike ${"%"+q+"%"}
            )
          order by issue_date desc, created_at desc
          limit 500
        `
      : await db`
          select *
          from invoices
          where business_id=${integration.business_id}
            and issue_date between ${from} and ${to}
          order by issue_date desc, created_at desc
          limit 500
        `;

    const summaryRows=await db`
      select
        count(*) filter (where invoice_operation='CREATE')::int as issued_count,
        coalesce(sum(gross_amount_huf) filter (where invoice_operation='CREATE'),0)::bigint as issued_gross_huf,
        count(*) filter (where invoice_operation='MODIFY')::int as modify_count,
        count(*) filter (where invoice_operation='STORNO')::int as storno_count,
        count(distinct nullif(partner_name,'')) filter (where invoice_operation='CREATE')::int as customer_count,
        coalesce(avg(gross_amount_huf) filter (where invoice_operation='CREATE'),0)::numeric as average_gross_huf,
        count(*) filter (where status='paid')::int as paid_count
      from invoices
      where business_id=${integration.business_id}
        and issue_date between ${from} and ${to}
    `;

    const monthly=await db`
      select
        to_char(date_trunc('month',issue_date),'YYYY-MM') as month,
        count(*) filter (where invoice_operation='CREATE')::int as count,
        coalesce(sum(gross_amount_huf) filter (where invoice_operation='CREATE'),0)::bigint as gross_huf
      from invoices
      where business_id=${integration.business_id}
        and issue_date between ${from} and ${to}
      group by 1
      order by 1
    `;

    const quarterly=await db`
      select
        extract(year from issue_date)::int as year,
        extract(quarter from issue_date)::int as quarter,
        count(*) filter (where invoice_operation='CREATE')::int as count,
        coalesce(sum(gross_amount_huf) filter (where invoice_operation='CREATE'),0)::bigint as gross_huf,
        coalesce(avg(gross_amount_huf) filter (where invoice_operation='CREATE'),0)::numeric as avg_huf
      from invoices
      where business_id=${integration.business_id}
        and issue_date between ${from} and ${to}
      group by 1,2
      order by 1,2
    `;

    const topCustomers=await db`
      select
        coalesce(nullif(partner_name,''),'Magánszemély / nincs név') as name,
        count(*)::int as count,
        coalesce(sum(gross_amount_huf),0)::bigint as gross_huf
      from invoices
      where business_id=${integration.business_id}
        and issue_date between ${from} and ${to}
        and invoice_operation='CREATE'
      group by 1
      order by gross_huf desc
      limit 8
    `;

    const paymentMethods=await db`
      select
        coalesce(nullif(payment_method,''),'UNKNOWN') as method,
        count(*)::int as count,
        coalesce(sum(gross_amount_huf),0)::bigint as gross_huf
      from invoices
      where business_id=${integration.business_id}
        and issue_date between ${from} and ${to}
        and invoice_operation='CREATE'
      group by 1
      order by gross_huf desc
    `;

    const allYears=await db`
      select
        extract(year from issue_date)::int as year,
        count(*) filter (where invoice_operation='CREATE')::int as count,
        coalesce(sum(gross_amount_huf) filter (where invoice_operation='CREATE'),0)::bigint as gross_huf,
        coalesce(avg(gross_amount_huf) filter (where invoice_operation='CREATE'),0)::numeric as avg_huf,
        count(distinct nullif(partner_name,'')) filter (where invoice_operation='CREATE')::int as customers
      from invoices
      where business_id=${integration.business_id}
      group by 1
      order by 1
    `;

    const allMonthly=await db`
      select
        extract(year from issue_date)::int as year,
        extract(month from issue_date)::int as month,
        count(*) filter (where invoice_operation='CREATE')::int as count,
        coalesce(sum(gross_amount_huf) filter (where invoice_operation='CREATE'),0)::bigint as gross_huf
      from invoices
      where business_id=${integration.business_id}
      group by 1,2
      order by 1,2
    `;

    return Response.json({
      configured:true,
      businessName:integration.business_name,
      taxNumber:integration.tax_number,
      lastSyncAt:integration.last_sync_at,
      lastSyncStatus:integration.last_sync_status,
      lastError:integration.last_error,
      from,to,
      summary:summaryRows[0],
      monthly,
      quarterly,
      topCustomers,
      paymentMethods,
      allYears,
      allMonthly,
      invoices:rows,
    });
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    if(error instanceof Error&&error.message==="FORBIDDEN"){
      return Response.json({error:"Ehhez nincs jogosultságod."},{status:403});
    }
    return Response.json({error:"Nem sikerült betölteni a NAV számlákat."},{status:500});
  }
}

export async function POST(request:Request){
  try{
    const {integration,auth,user,household}=await getNavAuth();
    const body=await request.json().catch(()=>({})) as {from?:string;to?:string};
    const now=new Date();
    const defaultFrom=`${now.getUTCFullYear()}-01-01`;
    const defaultTo=dateOnly(now);
    const from=body.from||defaultFrom;
    const to=body.to||defaultTo;
    const db=sql();

    await db`
      update nav_integrations
      set last_sync_status='syncing',last_error=null,updated_at=now()
      where id=${integration.id}
    `;

    let imported=0;
    let seen=0;

    for(const range of chunks(from,to)){
      const digests=await queryIssuedInvoiceDigests(auth,range.from,range.to);
      seen+=digests.length;

      for(const d of digests){
        const netHuf=d.invoiceNetAmountHUF??(d.currency==="HUF"?d.invoiceNetAmount:null)??0;
        const vatHuf=d.invoiceVatAmountHUF??(d.currency==="HUF"?d.invoiceVatAmount:null)??0;
        const grossHuf=Math.round(netHuf+vatHuf);
        const externalId=[
          d.invoiceNumber,
          d.invoiceOperation,
          d.transactionId||"",
          d.index??"",
          d.batchIndex??"",
        ].join("|");
        const status=d.invoiceOperation==="STORNO"
          ?"cancelled"
          :d.paymentDate
            ?"paid"
            :"issued";

        const result=await db`
          insert into invoices(
            household_id,business_id,source,external_id,invoice_number,partner_name,
            issue_date,paid_at,net_amount_huf,vat_amount_huf,gross_amount_huf,status,
            currency,customer_tax_number,invoice_category,payment_method,payment_date,
            invoice_delivery,invoice_appearance,invoice_operation,original_invoice_number,
            nav_source,transaction_id,transaction_index,raw_payload
          ) values(
            ${household.id},${integration.business_id},'nav',${externalId},${d.invoiceNumber},
            ${d.customerName||"Magánszemély / nincs név"},${d.invoiceIssueDate},
            ${d.paymentDate||null},${Math.round(netHuf)},${Math.round(vatHuf)},${grossHuf},
            ${status}::invoice_status,${d.currency},${d.customerTaxNumber},
            ${d.invoiceCategory},${d.paymentMethod},${d.paymentDate},${d.invoiceDelivery},
            ${d.invoiceAppearance},${d.invoiceOperation},${d.originalInvoiceNumber},
            ${d.source},${d.transactionId},${d.index},${JSON.stringify(d.raw)}::jsonb
          )
          on conflict(business_id,source,external_id) do update set
            invoice_number=excluded.invoice_number,
            partner_name=excluded.partner_name,
            issue_date=excluded.issue_date,
            paid_at=excluded.paid_at,
            net_amount_huf=excluded.net_amount_huf,
            vat_amount_huf=excluded.vat_amount_huf,
            gross_amount_huf=excluded.gross_amount_huf,
            status=excluded.status,
            currency=excluded.currency,
            customer_tax_number=excluded.customer_tax_number,
            invoice_category=excluded.invoice_category,
            payment_method=excluded.payment_method,
            payment_date=excluded.payment_date,
            invoice_delivery=excluded.invoice_delivery,
            invoice_appearance=excluded.invoice_appearance,
            invoice_operation=excluded.invoice_operation,
            original_invoice_number=excluded.original_invoice_number,
            nav_source=excluded.nav_source,
            transaction_id=excluded.transaction_id,
            transaction_index=excluded.transaction_index,
            raw_payload=excluded.raw_payload
          returning id
        `;
        if(result.length) imported++;
      }
    }

    await db`
      update nav_integrations
      set last_sync_at=now(),last_sync_status='success',last_error=null,updated_at=now()
      where id=${integration.id}
    `;

    await db`
      insert into audit_log(household_id,actor_user_id,action,entity_type,entity_id)
      values(${household.id},${user.id},'sync','nav_invoices',${integration.id})
    `;

    return Response.json({ok:true,from,to,seen,imported});
  }catch(error){
    try{
      const ctx=await getNavIntegration();
      if(ctx.integration){
        const db=sql();
        await db`
          update nav_integrations
          set last_sync_status='error',last_error=${error instanceof Error?error.message:"Ismeretlen NAV hiba"},updated_at=now()
          where id=${ctx.integration.id}
        `;
      }
    }catch{}
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    if(error instanceof Error&&error.message==="FORBIDDEN"){
      return Response.json({error:"Ehhez nincs jogosultságod."},{status:403});
    }
    if(error instanceof Error&&error.message==="NAV_NOT_CONFIGURED"){
      return Response.json({error:"A NAV kapcsolat még nincs beállítva."},{status:400});
    }
    return Response.json({error:error instanceof Error?error.message:"Nem sikerült a NAV szinkron."},{status:500});
  }
}
