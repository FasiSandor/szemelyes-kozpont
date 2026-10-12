import {NextRequest,NextResponse} from "next/server";

const CORE="https://calendar-core.vercel.app/api/source-events";
const LINK="https://szemelyes-kozpont.vercel.app/?screen=nav&tab=deadlines";

export async function GET(req:NextRequest){
  const secret=process.env.CRON_SECRET||"";
  const auth=req.headers.get("authorization")||"";
  if(!secret||auth!=="Bearer "+secret)return NextResponse.json({ok:false,error:"forbidden"},{status:403});
  const sourceKey=process.env.CALENDAR_SOURCE_API_KEY||"";
  if(!sourceKey)return NextResponse.json({ok:false,error:"calendar_source_not_configured"},{status:503});

  try{
    const r=await fetch(new URL("/api/nav/deadlines",req.url),{cache:"no-store"});
    if(!r.ok)return NextResponse.json({ok:false,error:"nav_deadlines_unavailable"},{status:502});
    const j=await r.json();
    const items=Array.isArray(j.deadlines)?j.deadlines:[];
    let synced=0,failed=0;

    for(const x of items){
      const date=String(x.date||"").slice(0,10),id=String(x.id||"");
      if(!id||!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
      const body={
        title:String(x.title||"NAV határidő"),
        date,allDay:true,timezone:"Europe/Budapest",category:"work",
        location:"",note:[x.detail,x.category,x.source].filter(Boolean).join(" · "),
        sourceApp:"szemelyes-kozpont",sourceRecordId:id,sourceUrl:j.sourceUrl||LINK,
        metadata:{
          linkedApp:"Személyes Központ",
          linkedLabel:"NAV Határidők",
          linkedUrl:LINK,
          sourceUrl:j.sourceUrl||null,
          category:x.category||null,
          source:x.source||"NAV"
        }
      };
      const u=await fetch(CORE,{
        method:"POST",
        headers:{"content-type":"application/json","x-calendar-source-key":sourceKey},
        body:JSON.stringify(body),
        cache:"no-store"
      });
      if(u.ok)synced++;else failed++;
    }
    return NextResponse.json({ok:true,synced,failed,total:items.length});
  }catch(e:any){
    return NextResponse.json({ok:false,error:e?.message||"sync_failed"},{status:500});
  }
}
