const SOURCE="https://nav.gov.hu/print/nyomtatvanyok/letoltesek/nyomtatvanykitolto_programok/nyomtatvanykitolto_programok_nav/2658";
const CALENDAR="https://ugyfelportal.nav.gov.hu/";

function normalizeDate(value:string){
  const m=value.match(/(20\d{2})\.(\d{2})\.(\d{2})\.?/);
  return m?`${m[1]}-${m[2]}-${m[3]}`:null;
}

export async function GET(){
  const fallback=["2026-04-13","2026-07-13","2026-10-12","2027-01-12"];
  let dates=fallback;
  let live=false;

  try{
    const res=await fetch(SOURCE,{next:{revalidate:21600}});
    if(res.ok){
      const html=await res.text();
      const found=[...html.matchAll(/20\d{2}\.\d{2}\.\d{2}\.?/g)]
        .map(x=>normalizeDate(x[0]))
        .filter((x):x is string=>Boolean(x))
        .filter(x=>{
          const [,m,d]=x.split("-").map(Number);
          return [1,4,7,10].includes(m)&&d>=10&&d<=15;
        });
      const unique=[...new Set(found)].sort();
      const minYear=new Date().getUTCFullYear()-1;
      const plausible=unique.filter(x=>Number(x.slice(0,4))>=minYear).slice(-8);
      if(plausible.length>=4){
        dates=plausible;
        live=true;
      }
    }
  }catch{}

  const today=new Date().toISOString().slice(0,10);
  const quarterly=dates.map(date=>({
    id:`2658-${date}`,
    date,
    title:"2658 bevallás és befizetés",
    detail:"Egyéni vállalkozói tb-járulék és szocho negyedéves határideje.",
    category:"Járulék / szocho",
    source:"NAV 2658",
    status:date<today?"past":date===today?"today":"upcoming"
  }));

  const year=new Date().getUTCFullYear();
  const annual=[
    {
      id:`szja-${year}`,
      date:`${year}-05-20`,
      title:"SZJA-bevallás",
      detail:"Az egyéni vállalkozó éves személyijövedelemadó-bevallásának általános határideje.",
      category:"Éves bevallás",
      source:"NAV",
      status:`${year}-05-20`<today?"past":"upcoming"
    },
    {
      id:`szja-${year+1}`,
      date:`${year+1}-05-20`,
      title:"SZJA-bevallás",
      detail:"Következő éves személyijövedelemadó-bevallási határidő.",
      category:"Éves bevallás",
      source:"NAV",
      status:"upcoming"
    }
  ];

  const deadlines=[...quarterly,...annual].sort((a,b)=>a.date.localeCompare(b.date));

  try{
    const key=process.env.CALENDAR_SOURCE_API_KEY||"";
    if(key){
      const linkedUrl="https://szemelyes-kozpont.vercel.app/?screen=nav&tab=deadlines";
      await Promise.allSettled(deadlines.filter(item=>item.date>=today).map(item=>fetch("https://calendar-core.vercel.app/api/source-events",{
        method:"POST",
        headers:{"content-type":"application/json","x-calendar-source-key":key},
        body:JSON.stringify({
          title:item.title,
          date:item.date,
          allDay:true,
          timezone:"Europe/Budapest",
          category:"work",
          location:"",
          note:item.detail+" · "+item.category+" · "+item.source,
          sourceApp:"szemelyes-kozpont",
          sourceRecordId:item.id,
          sourceUrl:linkedUrl,
          metadata:{
            linkedApp:"szemelyes-kozpont",
            linkedLabel:"Személyes Központ · NAV Határidők",
            linkedUrl,
            sourceKind:"nav-deadline"
          }
        }),
        cache:"no-store"
      })));
    }
  }catch{}

  return Response.json({
    live,
    sourceUrl:SOURCE,
    calendarUrl:CALENDAR,
    fetchedAt:new Date().toISOString(),
    deadlines
  });
}
