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
        .filter((x):x is string=>Boolean(x));
      const unique=[...new Set(found)].sort();
      if(unique.length>=4){
        dates=unique;
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

  return Response.json({
    live,
    sourceUrl:SOURCE,
    calendarUrl:CALENDAR,
    fetchedAt:new Date().toISOString(),
    deadlines:[...quarterly,...annual].sort((a,b)=>a.date.localeCompare(b.date))
  });
}
