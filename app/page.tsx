"use client";
// deploy-kick: nav-date-buckets-v1
// deploy-kick: revenue-nav-deadlines-v2

import { useEffect, useMemo, useRef, useState } from "react";
import { createVault, getLocalVaultPayload, saveVault, setLocalVaultPayload, unlockVault, vaultExists, type StoredVault, type VaultEntry } from "@/lib/vault";
import SecureGate from "@/components/SecureGate";
import QRCode from "react-qr-code";

type Screen = "home" | "docs" | "finance" | "tasks" | "more" | "business" | "nav" | "vault" | "cards" | "vehicles" | "reports";

const bars=[36,62,48,76,58,94,69,42,55,80,67,91];
const docs=[
  ["Személyazonosító igazolvány","Érvényes: 2031.06.12.","id"],
  ["Lakcímkártya","Érvényes: határozatlan",""],
  ["TAJ kártya","Egészségügyi azonosító",""],
  ["Adókártya","Adóazonosító jel",""],
  ["Pedagógusigazolvány","Munkahelyi okmány",""],
  ["Diákigazolvány","Családtaghoz rendelve",""],
];

function Icon({children,tone=""}:{children:React.ReactNode;tone?:string}) {
  return <div className={"icon "+tone}>{children}</div>
}
function Header({title="Személyes Központ",back,onBack}:{title?:string;back?:boolean;onBack?:()=>void}) {
  return <div className="topbar">
    <div className="row">
      {back && <button className="ghost-btn" onClick={onBack} aria-label="Vissza">‹</button>}
      <div><div className="eyebrow">2026. október 6.</div><div className="title">{title}</div></div>
    </div>
    <div className="avatar">SK</div>
  </div>
}
function BottomNav({screen,setScreen}:{screen:Screen;setScreen:(s:Screen)=>void}) {
  const nav:[Screen,string,string][]=[
    ["home","⌂","Főoldal"],["docs","▤","Iratok"],["finance","◴","Pénzügyek"],["business","▥","Vállalkozás"],["more","☰","Több"]
  ];
  return <div className="bottom"><div className="nav">{nav.map(([id,ic,label])=>
    <button key={id} className={screen===id?"on":""} onClick={()=>setScreen(id)}><span className="ni">{ic}</span>{label}</button>
  )}</div></div>
}
function MetricCard({icon,label,value,delta,tone=""}:{icon:string;label:string;value:string;delta:string;tone?:string}) {
  return <div className="card">
    <div className="row"><Icon tone={tone}>{icon}</Icon><div className="label">{label}</div></div>
    <div className="metric">{value}</div><div className={"delta "+(delta.startsWith("−")?"down":"")}>{delta}</div>
  </div>
}
function MiniChart() {
  return <div className="chart">{bars.map((h,i)=><div className="bar" key={i} style={{height:h+"%"}} />)}</div>
}
function Home({go}:{go:(s:Screen)=>void}) {
  const [navData,setNavData]=useState<NavInvoiceData|null>(null);
  const [financeData,setFinanceData]=useState<FinanceData|null>(null);
  const [previousFinanceData,setPreviousFinanceData]=useState<FinanceData|null>(null);
  const [homeFamilyCount,setHomeFamilyCount]=useState(0);
  const [homeDocuments,setHomeDocuments]=useState<Array<{id:string;title:string;member_name:string;expiry_date:string|null}>>([]);
  useEffect(()=>{
    let active=true;
    const current=new Date();
    const month=current.toISOString().slice(0,7);
    const prev=new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()-1,1)).toISOString().slice(0,7);
    Promise.all([
      fetch("/api/nav/invoices?year="+new Date().getFullYear(),{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/finance/transactions?month="+month,{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/finance/transactions?month="+prev,{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/household",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/documents",{cache:"no-store"}).then(r=>r.json())
    ]).then(([nav,finance,previous,household,docs])=>{
      if(!active)return;
      setNavData(nav);
      setFinanceData(finance);
      setPreviousFinanceData(previous);
      setHomeFamilyCount((household.members||[]).length);
      setHomeDocuments(docs.documents||[]);
    }).catch(()=>{});
    return()=>{active=false;};
  },[]);
  const navReady=Boolean(navData?.configured);
  const navSummary=navData?.summary;
  const allYears=(navData?.allYears||[]).slice().sort((a,b)=>a.year-b.year);
  const totalInvoices=allYears.reduce((n,x)=>n+Number(x.count||0),0);
  const totalRevenue=allYears.reduce((n,x)=>n+Number(x.gross_huf||0),0);
  const homeIncome=Number(financeData?.totals?.income_huf||0);
  const homeExpense=Number(financeData?.totals?.expense_huf||0);
  const homeBalance=homeIncome-homeExpense;
  const prevIncome=Number(previousFinanceData?.totals?.income_huf||0);
  const prevExpense=Number(previousFinanceData?.totals?.expense_huf||0);
  const flowMax=Math.max(1,homeIncome,homeExpense);
  const topCategories=(financeData?.categories||[]).slice(0,3);
  const topCategoryMax=Math.max(1,...topCategories.map(x=>Number(x.amount_huf||0)));
  const expenseDelta=prevExpense?Math.round((homeExpense-prevExpense)/prevExpense*100):null;
  const incomeDelta=prevIncome?Math.round((homeIncome-prevIncome)/prevIncome*100):null;
  const nowDay=new Date();nowDay.setHours(0,0,0,0);
  const homeExpiringDocs=homeDocuments
    .filter(x=>x.expiry_date)
    .map(x=>({...x,days:Math.ceil((new Date(x.expiry_date!+"T00:00:00").getTime()-nowDay.getTime())/86400000)}))
    .filter(x=>x.days<=60)
    .sort((a,b)=>a.days-b.days)
    .slice(0,5);

  return <div className="page home-v2">
    <Header/>
    <div className="notice home-upcoming">
      <div className="row between"><div><b>Közelgő</b><div className="subtle" style={{marginTop:4}}>Teendők, iratlejáratok és határidők</div></div><span className="badge amber">{homeExpiringDocs.length?homeExpiringDocs.length+" irat figyelmet kér":"Áttekintés"}</span></div>
      <div className="home-upcoming-list">
        {homeExpiringDocs.map(doc=><button className="row home-upcoming-row" key={doc.id} onClick={()=>go("docs")}>
          <Icon tone={doc.days<0?"red":"amber"}>▣</Icon>
          <div className="grow"><b>{doc.title}</b><div className="label">{doc.member_name} · {doc.days<0?"lejárt "+Math.abs(doc.days)+" napja":doc.days===0?"ma jár le":doc.days+" nap múlva lejár"}</div></div>
          <span className="chev">›</span>
        </button>)}
        <button className="row home-upcoming-row" onClick={()=>go("tasks")}><Icon tone="amber">◷</Icon><div className="grow"><b>Teendők</b><div className="label">Személyes és családi feladatok</div></div><span className="chev">›</span></button>
        <button className="row home-upcoming-row" onClick={()=>go("nav")}><Icon tone="amber">N</Icon><div className="grow"><b>NAV és vállalkozási határidők</b><div className="label">Adó, bevallás, gépjármű és egyéb határidők</div></div><span className="chev">›</span></button>
      </div>
    </div>

    <div className="section-title">Áttekintés</div>
    <div className="grid hero-grid home-overview-grid">
      <button className="card active home-overview-card" onClick={()=>go("business")}>
        <div className="row between"><Icon>▥</Icon><span className="badge">Vállalkozás</span></div>
        <div className="label">Idei kiszámlázott bruttó</div>
        <div className="metric">{navReady?money(navSummary?.issued_gross_huf):"NAV kapcsolat"}</div>
        <div className="delta">{navReady?(navSummary?.issued_count||0)+" számla idén":"Kapcsolat beállítása"}</div>
      </button>
      <button className="card home-overview-card" onClick={()=>go("nav")}>
        <div className="row between"><Icon tone={navReady?"green":""}>N</Icon><span className={"badge "+(navReady?"green":"amber")}>{navReady?"Kapcsolva":"Nincs bekötve"}</span></div>
        <div className="label">NAV számlatörténet</div>
        <div className="metric">{navReady?money(totalRevenue):"—"}</div>
        <div className="delta">{navReady?totalInvoices+" számla összesen":"Technikai felhasználó szükséges"}</div>
      </button>
      <button className="card home-overview-card" onClick={()=>go("docs")}>
        <div className="row between"><Icon tone="cyan">♙</Icon><span className="badge">Család</span></div>
        <div className="label">Családi irattár</div>
        <div className="metric">{homeFamilyCount||1} profil</div>
        <div className="delta">{homeDocuments.length?homeDocuments.length+" irat · "+homeExpiringDocs.length+" figyelmet kér":"Okmányok és lejáratok"}</div>
      </button>
      <button className="card home-overview-card" onClick={()=>go("finance")}>
        <div className="row between"><Icon>◴</Icon><span className="badge">Pénzügyek</span></div>
        <div className="label">Havi pénzügyi kép</div>
        <div className="metric">Megoszlások</div>
        <div className="delta">Mire költök? · Hol költök?</div>
      </button>
    </div>

    <div className="section-title">Havi pénzügyi kép</div>
    <div className="card home-finance-summary home-cashflow-summary">
      <div className="row between">
        <div><b>Aktuális havi pénzmozgás</b><div className="label">Gyors összefoglaló · részletek a Pénzügyekben</div></div>
        <button className="ghost-btn" onClick={()=>go("finance")}>Részletek ›</button>
      </div>

      <div className="home-cashflow-kpis">
        <div><span>Bevétel</span><b className="finance-positive">{money(homeIncome)}</b>{incomeDelta!==null&&<small className={incomeDelta>=0?"up":"down"}>{incomeDelta>=0?"+":""}{incomeDelta}% előző hóhoz</small>}</div>
        <div><span>Kiadás</span><b>{money(homeExpense)}</b>{expenseDelta!==null&&<small className={expenseDelta<=0?"up":"down"}>{expenseDelta>=0?"+":""}{expenseDelta}% előző hóhoz</small>}</div>
        <div><span>Maradvány</span><b className={homeBalance>=0?"finance-positive":"finance-negative"}>{money(homeBalance)}</b><small>{homeBalance>=0?"pozitív egyenleg":"negatív egyenleg"}</small></div>
      </div>

      <div className="home-flow-bars">
        <div className="home-flow-row"><span>Bevétel</span><div className="home-flow-track"><i className="income" style={{width:Math.max(4,homeIncome/flowMax*100)+"%"}}/></div><b>{money(homeIncome)}</b></div>
        <div className="home-flow-row"><span>Kiadás</span><div className="home-flow-track"><i className="expense" style={{width:Math.max(4,homeExpense/flowMax*100)+"%"}}/></div><b>{money(homeExpense)}</b></div>
      </div>

      <div className="home-top-spend">
        <div className="row between"><b>Top kiadási területek</b><span className="label">aktuális hónap</span></div>
        {topCategories.length?topCategories.map((x,i)=><div className="home-top-row" key={x.name}>
          <div className="row between"><span>{i+1}. {x.name}</span><b>{money(x.amount_huf)}</b></div>
          <div className="home-top-track"><i style={{width:Math.max(5,Number(x.amount_huf||0)/topCategoryMax*100)+"%"}}/></div>
        </div>):<div className="label">Még nincs kiadási adat ebben a hónapban.</div>}
      </div>
    </div>

    <div className="section-title">Gyorsműveletek</div>
    <div className="quick-actions-grid">
      <button className="list-item" onClick={()=>go("docs")}><Icon>▤</Icon><div className="grow"><b>Irat</b><div className="label">Fotó / feltöltés</div></div><span className="chev">›</span></button>
      <button className="list-item" onClick={()=>go("tasks")}><Icon>✓</Icon><div className="grow"><b>Teendő</b><div className="label">Lista megnyitása</div></div><span className="chev">›</span></button>
      <button className="list-item" onClick={()=>go("nav")}><Icon>N</Icon><div className="grow"><b>NAV</b><div className="label">Számlák és határidők</div></div><span className="chev">›</span></button>
      <button className="list-item" onClick={()=>go("vault")}><Icon>⌘</Icon><div className="grow"><b>Jelszótár</b><div className="label">Titkosított Vault</div></div><span className="chev">›</span></button>
    </div>
  </div>
}


type ScanPoint={x:number;y:number};

function solveLinear8(a:number[][],b:number[]){
  const m=a.map((row,i)=>[...row,b[i]]);
  for(let col=0;col<8;col++){
    let pivot=col;
    for(let r=col+1;r<8;r++)if(Math.abs(m[r][col])>Math.abs(m[pivot][col]))pivot=r;
    [m[col],m[pivot]]=[m[pivot],m[col]];
    const div=m[col][col]||1e-12;
    for(let c=col;c<=8;c++)m[col][c]/=div;
    for(let r=0;r<8;r++){
      if(r===col)continue;
      const f=m[r][col];
      for(let c=col;c<=8;c++)m[r][c]-=f*m[col][c];
    }
  }
  return m.map(row=>row[8]);
}

function homographyRectToQuad(w:number,h:number,q:ScanPoint[]){
  const dst=[[0,0],[w,0],[w,h],[0,h]];
  const A:number[][]=[]; const B:number[]=[];
  for(let i=0;i<4;i++){
    const [x,y]=dst[i], sx=q[i].x, sy=q[i].y;
    A.push([x,y,1,0,0,0,-sx*x,-sx*y]);B.push(sx);
    A.push([0,0,0,x,y,1,-sy*x,-sy*y]);B.push(sy);
  }
  const [a,b,c,d,e,f,g,hh]=solveLinear8(A,B);
  return (x:number,y:number)=>{
    const den=g*x+hh*y+1;
    return {x:(a*x+b*y+c)/den,y:(d*x+e*y+f)/den};
  };
}

function drawTriangle(
  ctx:CanvasRenderingContext2D,img:HTMLImageElement,
  s0:ScanPoint,s1:ScanPoint,s2:ScanPoint,
  d0:ScanPoint,d1:ScanPoint,d2:ScanPoint
){
  const den=s0.x*(s1.y-s2.y)+s1.x*(s2.y-s0.y)+s2.x*(s0.y-s1.y);
  if(Math.abs(den)<1e-8)return;
  const a=(d0.x*(s1.y-s2.y)+d1.x*(s2.y-s0.y)+d2.x*(s0.y-s1.y))/den;
  const c=(d0.x*(s2.x-s1.x)+d1.x*(s0.x-s2.x)+d2.x*(s1.x-s0.x))/den;
  const e=(d0.x*(s1.x*s2.y-s2.x*s1.y)+d1.x*(s2.x*s0.y-s0.x*s2.y)+d2.x*(s0.x*s1.y-s1.x*s0.y))/den;
  const bb=(d0.y*(s1.y-s2.y)+d1.y*(s2.y-s0.y)+d2.y*(s0.y-s1.y))/den;
  const dd=(d0.y*(s2.x-s1.x)+d1.y*(s0.x-s2.x)+d2.y*(s1.x-s0.x))/den;
  const ff=(d0.y*(s1.x*s2.y-s2.x*s1.y)+d1.y*(s2.x*s0.y-s0.x*s2.y)+d2.y*(s0.x*s1.y-s1.x*s0.y))/den;
  ctx.save();
  ctx.beginPath();ctx.moveTo(d0.x,d0.y);ctx.lineTo(d1.x,d1.y);ctx.lineTo(d2.x,d2.y);ctx.closePath();ctx.clip();
  ctx.setTransform(a,bb,c,dd,e,ff);ctx.drawImage(img,0,0);ctx.restore();
}

async function perspectiveCropFile(file:File,corners:ScanPoint[]){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const el=new Image();el.onload=()=>resolve(el);el.onerror=reject;el.src=url;
    });
    const q=corners.map(p=>({x:p.x*img.naturalWidth,y:p.y*img.naturalHeight}));
    const dist=(p:ScanPoint,r:ScanPoint)=>Math.hypot(p.x-r.x,p.y-r.y);
    let w=Math.round(Math.max(dist(q[0],q[1]),dist(q[3],q[2])));
    let h=Math.round(Math.max(dist(q[0],q[3]),dist(q[1],q[2])));
    const maxW=1500;
    if(w>maxW){const k=maxW/w;w=Math.round(w*k);h=Math.round(h*k);}
    w=Math.max(320,w);h=Math.max(200,h);
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d");if(!ctx)throw new Error("A kép feldolgozása nem sikerült.");
    ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);
    const map=homographyRectToQuad(w,h,q);
    const cols=28,rows=18;
    for(let iy=0;iy<rows;iy++){
      for(let ix=0;ix<cols;ix++){
        const x0=ix*w/cols,x1=(ix+1)*w/cols,y0=iy*h/rows,y1=(iy+1)*h/rows;
        const s00=map(x0,y0),s10=map(x1,y0),s11=map(x1,y1),s01=map(x0,y1);
        const d00={x:x0,y:y0},d10={x:x1,y:y0},d11={x:x1,y:y1},d01={x:x0,y:y1};
        drawTriangle(ctx,img,s00,s10,s11,d00,d10,d11);
        drawTriangle(ctx,img,s00,s11,s01,d00,d11,d01);
      }
    }
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("A kép mentése nem sikerült.")),"image/jpeg",0.95));
    return new File([blob],file.name.replace(/\.[^.]+$/,"")+"_scan.jpg",{type:"image/jpeg"});
  }finally{URL.revokeObjectURL(url);}
}

async function imageUrlToDataUrl(url:string){
  const res=await fetch(url);if(!res.ok)throw new Error("Az iratkép nem tölthető le.");
  const blob=await res.blob();
  return await new Promise<string>((resolve,reject)=>{
    const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(blob);
  });
}



type A4PrintItem={imageUrl:string;title:string;label:string;isCard:boolean};
type A4PlacedItem=A4PrintItem&{sheet:number;x:number;y:number;w:number;h:number};

function layoutA4Items(items:A4PrintItem[]){
  const placed:A4PlacedItem[]=[];
  let sheet=0,cardSlot=0,hasAnything=false;
  for(const item of items){
    if(item.isCard){
      if(cardSlot>=8){sheet++;cardSlot=0;hasAnything=false;}
      const col=cardSlot%2,row=Math.floor(cardSlot/2);
      placed.push({...item,sheet,x:14+col*96,y:16+row*64,w:85.6,h:53.98});
      cardSlot++;hasAnything=true;
    }else{
      if(hasAnything){sheet++;cardSlot=0;}
      placed.push({...item,sheet,x:15,y:18,w:180,h:254});
      sheet++;cardSlot=0;hasAnything=false;
    }
  }
  const sheets=Math.max(1,placed.length?Math.max(...placed.map(x=>x.sheet))+1:1);
  return {placed,sheets};
}

async function createA4PrintPdf(items:A4PrintItem[],title:string){
  if(!items.length)return null;
  const {jsPDF}=await import("jspdf");
  const layout=layoutA4Items(items);
  const pdf=new jsPDF({unit:"mm",format:"a4",orientation:"portrait"});
  let currentSheet=0;
  for(const item of layout.placed){
    while(currentSheet<item.sheet){pdf.addPage();currentSheet++;}
    const data=await imageUrlToDataUrl(item.imageUrl);
    if(item.isCard){
      pdf.addImage(data,"JPEG",item.x,item.y,item.w,item.h,undefined,"FAST");
    }else{
      const img=new Image();
      await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=reject;img.src=data;});
      const ratio=img.naturalWidth/img.naturalHeight;
      let w=180,h=w/ratio;if(h>254){h=254;w=h*ratio;}
      pdf.addImage(data,"JPEG",(210-w)/2,18,w,h,undefined,"FAST");
    }
  }
  return pdf.output("blob");
}

async function shareOrSavePdf(blob:Blob,title:string){
  const file=new File([blob],title.replace(/[^\p{L}\p{N}_-]+/gu,"_")+".pdf",{type:"application/pdf"});
  if(navigator.share&&navigator.canShare?.({files:[file]})){
    await navigator.share({files:[file],title});
    return;
  }
  const href=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=href;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(href),2000);
}

function Docs({cardOnly=false}:{cardOnly?:boolean}={}) {
  type RemoteMember={id:string;display_name:string;relation:string|null;linked_user_id:string|null};
  type DocPhoto={id:string;imageUrl:string;storageKey:string;pageIndex:number;side:string};
  type DocMeta={issuer?:string;last4?:string;codeValue?:string;codeType?:"qr"|"barcode"};
  type RemoteDocument={
    id:string;family_member_id:string;kind:string;title:string;issue_date:string|null;
    expiry_date:string|null;note:string|null;created_at:string;member_name:string;
    front:DocPhoto|null;back:DocPhoto|null;pages:DocPhoto[];metadata:DocMeta;
  };

  const kindOptions=[
    ["identity","Személyazonosító igazolvány"],["address","Lakcímkártya"],["tax","Adókártya"],
    ["health","TAJ kártya"],["student","Diákigazolvány"],["teacher","Pedagógusigazolvány"],
    ["vehicle","Jármű okmány"],["insurance","Biztosítás"],["contract","Szerződés"],
    ["bank_card","Bankkártya"],["loyalty_card","Hűségkártya"],["membership_card","Tagsági kártya"],
    ["shopping_card","Bevásárlókártya"],["other","Egyéb irat"]
  ] as const;
  const cardKinds=new Set(["bank_card","loyalty_card","membership_card","shopping_card"]);
  const cardVisualKinds=new Set(["identity","address","tax","health","student","teacher","bank_card","loyalty_card","membership_card","shopping_card"]);
  const dateOnly=(value:string|null|undefined)=>value?String(value).slice(0,10):"";
  const formatDocDate=(value:string|null|undefined)=>{
    const d=dateOnly(value);if(!d)return "Nincs megadva";
    const parsed=new Date(d+"T00:00:00");
    return Number.isNaN(parsed.getTime())?"Nincs megadva":parsed.toLocaleDateString("hu-HU");
  };

  const [family,setFamily]=useState<RemoteMember[]>([]);
  const [personId,setPersonId]=useState("");
  const [documents,setDocuments]=useState<RemoteDocument[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [showForm,setShowForm]=useState(false);
  const [saving,setSaving]=useState(false);
  const [kind,setKind]=useState(cardOnly?"bank_card":"identity");
  const [title,setTitle]=useState(cardOnly?"Bankkártya":"Személyazonosító igazolvány");
  const [issueDate,setIssueDate]=useState("");
  const [expiryDate,setExpiryDate]=useState("");
  const [note,setNote]=useState("");
  const [frontFile,setFrontFile]=useState<File|null>(null);
  const [backFile,setBackFile]=useState<File|null>(null);
  const [extraFiles,setExtraFiles]=useState<File[]>([]);
  const [docFilter,setDocFilter]=useState<"all"|"valid"|"expiring"|"expired">("all");
  const [openDocId,setOpenDocId]=useState<string|null>(null);
  const [issuer,setIssuer]=useState("");
  const [last4,setLast4]=useState("");
  const [codeValue,setCodeValue]=useState("");
  const [codeType,setCodeType]=useState<"qr"|"barcode">("qr");
  const [cropTarget,setCropTarget]=useState<{slot:"front"|"back"|"extra";file:File;extraIndex?:number}|null>(null);
  const [scanCorners,setScanCorners]=useState<ScanPoint[]>([
    {x:.06,y:.06},{x:.94,y:.06},{x:.94,y:.94},{x:.06,y:.94}
  ]);
  const [dragCorner,setDragCorner]=useState<number|null>(null);
  const [scanAspect,setScanAspect]=useState(3/4);
  const [pageByDoc,setPageByDoc]=useState<Record<string,number>>({});
  const [printOpen,setPrintOpen]=useState(false);
  const [printStep,setPrintStep]=useState<"select"|"preview">("select");
  const [printSelected,setPrintSelected]=useState<Record<string,number[]>>({});
  const [printBusy,setPrintBusy]=useState(false);
  const frontRef=useRef<HTMLInputElement>(null);
  const backRef=useRef<HTMLInputElement>(null);
  const extraRef=useRef<HTMLInputElement>(null);
  const cropImageUrl=useMemo(()=>cropTarget?URL.createObjectURL(cropTarget.file):"",[cropTarget]);
  useEffect(()=>()=>{if(cropImageUrl)URL.revokeObjectURL(cropImageUrl);},[cropImageUrl]);

  async function loadHousehold(){
    const res=await fetch("/api/household",{cache:"no-store"});
    if(!res.ok) throw new Error("A családi tér nem tölthető be.");
    const data=await res.json();
    const members=(data.members||[]) as RemoteMember[];
    setFamily(members);
    setPersonId(current=>current||members[0]?.id||"");
  }

  async function loadDocuments(){
    const res=await fetch("/api/documents",{cache:"no-store"});
    if(!res.ok) throw new Error("Az iratok nem tölthetők be.");
    const data=await res.json();
    setDocuments(data.documents||[]);
  }

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{await Promise.all([loadHousehold(),loadDocuments()]);}
      catch(e){if(active)setMessage(e instanceof Error?e.message:"Betöltési hiba.");}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[]);

  function resetForm(){
    setKind(cardOnly?"bank_card":"identity");
    setTitle(cardOnly?"Bankkártya":"Személyazonosító igazolvány");
    setIssueDate("");setExpiryDate("");setNote("");setIssuer("");setLast4("");setCodeValue("");setCodeType("qr");
    setFrontFile(null);setBackFile(null);setExtraFiles([]);setShowForm(false);
  }

  function changeKind(next:string){
    setKind(next);
    const label=kindOptions.find(([value])=>value===next)?.[1]||"Egyéb irat";
    setTitle(label);
  }

  function metadata(){
    return {
      issuer:issuer.trim()||undefined,
      last4:last4.trim().slice(-4)||undefined,
      codeValue:codeValue.trim()||undefined,
      codeType:codeValue.trim()?codeType:undefined
    };
  }

  async function uploadPage(file:File,pageIndex:number,side:"front"|"back"|"page",groupId?:string){
    const prepare=await fetch("/api/documents",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({action:"prepare",familyMemberId:personId,title,kind,contentType:file.type||"image/jpeg",documentGroupId:groupId,side,pageIndex})
    });
    const prep=await prepare.json();
    if(!prepare.ok) throw new Error(prep.error||"A feltöltés előkészítése nem sikerült.");
    const upload=await fetch(prep.uploadUrl,{method:"PUT",headers:{"content-type":file.type||"image/jpeg"},body:file});
    if(!upload.ok) throw new Error("A fotó feltöltése nem sikerült.");
    const finalize=await fetch("/api/documents",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({
        action:"finalize",familyMemberId:personId,title,kind,storageKey:prep.storageKey,
        documentGroupId:prep.documentGroupId,side,pageIndex,issueDate:issueDate||null,
        expiryDate:expiryDate||null,note:note||null,metadata:metadata()
      })
    });
    const saved=await finalize.json();
    if(!finalize.ok) throw new Error(saved.error||"Az irat mentése nem sikerült.");
    return prep.documentGroupId as string;
  }


  function chooseForScan(file:File|null,slot:"front"|"back"|"extra",extraIndex?:number){
    if(!file)return;
    setScanCorners([{x:.06,y:.06},{x:.94,y:.06},{x:.94,y:.94},{x:.06,y:.94}]);
    setCropTarget({slot,file,extraIndex});
  }

  async function acceptCrop(){
    if(!cropTarget)return;
    try{
      const scanned=await perspectiveCropFile(cropTarget.file,scanCorners);
      if(cropTarget.slot==="front")setFrontFile(scanned);
      else if(cropTarget.slot==="back")setBackFile(scanned);
      else{
        setExtraFiles(current=>{
          const next=[...current];
          const index=cropTarget.extraIndex??next.length;
          next[index]=scanned;
          return next;
        });
      }
      setCropTarget(null);
    }catch(e){setMessage(e instanceof Error?e.message:"A kivágás nem sikerült.");}
  }


  async function saveDocument(){
    if(!personId||!frontFile||!title.trim()) return;
    setSaving(true);setMessage("");
    try{
      let groupId=await uploadPage(frontFile,1,"front");
      if(backFile) groupId=await uploadPage(backFile,2,"back",groupId);
      for(let i=0;i<extraFiles.length;i++) groupId=await uploadPage(extraFiles[i],3+i,"page",groupId);
      await loadDocuments();
      setMessage("Az irat biztonságosan elmentve.");
      resetForm();
    }catch(e){setMessage(e instanceof Error?e.message:"Nem sikerült menteni az iratot.");}
    finally{setSaving(false);}
  }

  async function deleteDocument(doc:RemoteDocument){
    if(!window.confirm("Biztosan törlöd ezt az iratot?\\n\\n"+doc.title)) return;
    setMessage("Törlés…");
    const res=await fetch("/api/documents?groupId="+encodeURIComponent(doc.id),{method:"DELETE"});
    const data=await res.json();
    if(!res.ok){setMessage(data.error||"Nem sikerült törölni.");return;}
    await loadDocuments();setOpenDocId(null);setMessage("Az irat törölve.");
  }

  async function addFamilyMember(){
    const displayName=window.prompt("Családtag neve")?.trim();if(!displayName)return;
    const relation=window.prompt("Kapcsolat (pl. gyermek, házastárs)")?.trim()||"Családtag";
    const res=await fetch("/api/household",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({displayName,relation})});
    const data=await res.json();
    if(!res.ok){setMessage(data.error||"Nem sikerült hozzáadni.");return;}
    await loadHousehold();if(data.member?.id)setPersonId(data.member.id);
  }

  function expiryBadge(doc:RemoteDocument){
    if(!doc.expiry_date) return <span className="badge green">Nincs lejárat</span>;
    const today=new Date();today.setHours(0,0,0,0);
    const expiry=dateOnly(doc.expiry_date);
    if(!expiry)return <span className="badge green">Nincs lejárat</span>;
    const days=Math.ceil((new Date(expiry+"T00:00:00").getTime()-today.getTime())/86400000);
    if(days<0) return <span className="badge dangerBadge">Lejárt</span>;
    if(days<=30) return <span className="badge amber">{days} nap</span>;
    return <span className="badge green">Érvényes</span>;
  }

  const selected=family.find(x=>x.id===personId)??family[0];
  const personDocs=documents.filter(doc=>(!personId||doc.family_member_id===personId)&&(!cardOnly||cardKinds.has(doc.kind)));
  const today=new Date();today.setHours(0,0,0,0);
  const withExpiry=personDocs.map(doc=>{
    const expiry=dateOnly(doc.expiry_date);
    const days=expiry?Math.ceil((new Date(expiry+"T00:00:00").getTime()-today.getTime())/86400000):null;
    return {...doc,days};
  });
  const expiredCount=withExpiry.filter(x=>x.days!==null&&x.days<0).length;
  const expiringCount=withExpiry.filter(x=>x.days!==null&&x.days>=0&&x.days<=30).length;
  const validCount=withExpiry.length-expiredCount-expiringCount;
  const filteredDocs=withExpiry.filter(doc=>{
    if(docFilter==="expired")return doc.days!==null&&doc.days<0;
    if(docFilter==="expiring")return doc.days!==null&&doc.days>=0&&doc.days<=30;
    if(docFilter==="valid")return doc.days===null||doc.days>30;
    return true;
  }).sort((a,b)=>{
    if(a.days===null&&b.days===null)return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
    if(a.days===null)return 1;if(b.days===null)return -1;return a.days-b.days;
  });
  const kindIcon=(value:string)=>({
    identity:"▣",address:"⌂",tax:"N",health:"✚",student:"◫",teacher:"◆",vehicle:"🚙",
    insurance:"✓",contract:"▤",bank_card:"▥",loyalty_card:"◇",membership_card:"◎",shopping_card:"▦",other:"•"
  } as Record<string,string>)[value]||"•";
  const currentIsCard=cardKinds.has(kind);

  return <div className="page docs-v3">
    <Header title={cardOnly?"Kártyák":"Család és iratok"}/>

    <div className="profile-strip">
      {family.map((p,i)=><button key={p.id} className={"profile "+(personId===p.id?"selected":"")} onClick={()=>setPersonId(p.id)} style={{border:0,background:"transparent",color:"inherit"}}>
        <div className="picon">{i===0?"●":i===1?"◆":"○"}</div><small>{p.display_name}</small>
      </button>)}
      {!cardOnly&&<button className="profile" onClick={addFamilyMember} style={{border:0,background:"transparent",color:"inherit"}}><div className="picon">＋</div><small>Hozzáadás</small></button>}
    </div>

    <div className="row between docs-section-head">
      <div><div className="section-title" style={{margin:0}}>{cardOnly?"Kártyatárca":"Digitális irattartó"}</div><div className="label">{selected?selected.display_name+" · "+(selected.relation||"Családtag"):"Családi tér"}</div></div>
      <div className="row">
        <button className="ghost-btn" disabled={!personDocs.length} onClick={()=>{setPrintSelected({});setPrintStep("select");setPrintOpen(true);}}>▤ Nyomtatás</button>
        <button className="primary-btn" disabled={!personId} onClick={()=>setShowForm(true)}>＋ {cardOnly?"Új kártya":"Új irat"}</button>
      </div>
    </div>

    <div className="docs-toolbar card">
      <div className="docs-counts">
        <span><b>{personDocs.length}</b> {cardOnly?"kártya":"irat"}</span>
        <span className={expiringCount?"warn":""}><b>{expiringCount}</b> hamarosan</span>
        <span className={expiredCount?"danger":""}><b>{expiredCount}</b> lejárt</span>
      </div>
      <div className="docs-filter-segment">
        <button className={docFilter==="all"?"on":""} onClick={()=>setDocFilter("all")}>Mind</button>
        <button className={docFilter==="valid"?"on":""} onClick={()=>setDocFilter("valid")}>Rendben</button>
        <button className={docFilter==="expiring"?"on":""} onClick={()=>setDocFilter("expiring")}>Hamarosan</button>
        <button className={docFilter==="expired"?"on":""} onClick={()=>setDocFilter("expired")}>Lejárt</button>
      </div>
    </div>

    {message&&<div className="auth-message" style={{marginTop:12}}>{message}</div>}

    {showForm&&<div className="card doc-editor folder-editor">
      <div className="row between"><div><b>{cardOnly?"Új kártya":"Új irat"}</b><div className="label">{selected?.display_name}</div></div><button className="ghost-btn" onClick={resetForm}>Bezárás</button></div>
      <div className="form-card" style={{marginTop:14}}>
        <label className="label">Típus</label>
        <select className="input" value={kind} onChange={e=>changeKind(e.target.value)}>
          {kindOptions.filter(([value])=>cardOnly?cardKinds.has(value):true).map(([value,label])=><option value={value} key={value}>{label}</option>)}
        </select>
        <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Irat / kártya neve"/>
        {currentIsCard&&<div className="card-meta-grid">
          <input className="input" value={issuer} onChange={e=>setIssuer(e.target.value)} placeholder="Kibocsátó / üzlet (pl. OTP, Lidl)"/>
          {kind==="bank_card"&&<input className="input" inputMode="numeric" maxLength={4} value={last4} onChange={e=>setLast4(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="Utolsó 4 számjegy"/>}
          {kind!=="bank_card"&&<><input className="input" value={codeValue} onChange={e=>setCodeValue(e.target.value)} placeholder="Kártyaazonosító / QR érték"/>
          <select className="input" value={codeType} onChange={e=>setCodeType(e.target.value as "qr"|"barcode")}><option value="qr">QR-kód</option><option value="barcode">Vonalkód érték</option></select></>}
        </div>}
        <div className="doc-date-grid">
          <label><span className="label">Kiállítás</span><input className="input" type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)}/></label>
          <label><span className="label">Lejárat</span><input className="input" type="date" value={expiryDate} onChange={e=>setExpiryDate(e.target.value)}/></label>
        </div>
        <textarea className="input" rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Megjegyzés (opcionális)"/>

        <div className="doc-upload-grid">
          <button className={"doc-upload "+(frontFile?"ready":"")} onClick={()=>frontRef.current?.click()}><span className="doc-upload-icon">{frontFile?"✓":"＋"}</span><b>{currentIsCard?"Előlap":"1. oldal / előlap"}</b><small>{frontFile?frontFile.name:"Fotó készítése / kiválasztása"}</small></button>
          <button className={"doc-upload "+(backFile?"ready":"")} onClick={()=>backRef.current?.click()}><span className="doc-upload-icon">{backFile?"✓":"＋"}</span><b>{currentIsCard?"Hátlap":"2. oldal / hátlap"}</b><small>{backFile?backFile.name:"Opcionális"}</small></button>
        </div>
        {!currentIsCard&&<button className="ghost-btn doc-more-pages" onClick={()=>extraRef.current?.click()}>＋ További oldalak {extraFiles.length?"("+extraFiles.length+")":""}</button>}
        {extraFiles.length>0&&<div className="doc-file-list">{extraFiles.map((file,i)=><span key={file.name+i}>{i+3}. {file.name}</span>)}</div>}
        <input ref={frontRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={e=>chooseForScan(e.target.files?.[0]||null,"front")}/>
        <input ref={backRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={e=>chooseForScan(e.target.files?.[0]||null,"back")}/>
        <input ref={extraRef} className="sr-only" type="file" accept="image/*" onChange={e=>chooseForScan(e.target.files?.[0]||null,"extra",extraFiles.length)}/>
        <button className="primary-btn" disabled={!frontFile||saving} onClick={saveDocument}>{saving?"Mentés…":"Mentés az irattartóba"}</button>
      </div>
    </div>}


    {cropTarget&&<div className="scanner-overlay">
      <div className="scanner-shell">
        <div className="row between scanner-head"><div><b>Négy sarok beállítása</b><div className="label">Húzd a 4 pontot pontosan az irat sarkaira</div></div><button className="ghost-btn" onClick={()=>setCropTarget(null)}>Mégse</button></div>
        <div className="scanner-stage four-corner-stage" style={{aspectRatio:String(scanAspect)}}
          onPointerMove={e=>{
            if(dragCorner===null)return;
            const rect=e.currentTarget.getBoundingClientRect();
            const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
            const y=Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height));
            setScanCorners(points=>points.map((p,i)=>i===dragCorner?{x,y}:p));
          }}
          onPointerUp={()=>setDragCorner(null)}
          onPointerCancel={()=>setDragCorner(null)}
          onPointerLeave={()=>setDragCorner(null)}
        >
          <img src={cropImageUrl} alt="Körbevágandó irat" onLoad={e=>{const img=e.currentTarget;if(img.naturalHeight)setScanAspect(img.naturalWidth/img.naturalHeight);}}/>
          <svg className="scan-polygon" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            <polygon points={scanCorners.map(p=>(p.x*1000)+","+(p.y*1000)).join(" ")}/>
          </svg>
          {scanCorners.map((p,i)=><button key={i} className="scan-handle" style={{left:(p.x*100)+"%",top:(p.y*100)+"%"}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);setDragCorner(i);}} aria-label={(i+1)+". sarok"}>{i+1}</button>)}
        </div>
        <div className="scanner-controls">
          <button className="ghost-btn" onClick={()=>setScanCorners([{x:.06,y:.06},{x:.94,y:.06},{x:.94,y:.94},{x:.06,y:.94}])}>Alaphelyzet</button>
          <button className="primary-btn" onClick={acceptCrop}>✓ Kivágás és kiegyenesítés</button>
        </div>
      </div>
    </div>}

    {loading?<div className="empty-card"><div className="empty-icon">◷</div><b>Betöltés…</b></div>:
    personDocs.length===0?<div className="empty-card"><div className="empty-icon">{cardOnly?"▥":"▤"}</div><b>{cardOnly?"Még nincs mentett kártya":"Még nincs feltöltött irat"}</b><div className="label">A hozzáadás gombbal fotózd le vagy válaszd ki az oldalakat.</div></div>:
    filteredDocs.length===0?<div className="empty-card"><div className="empty-icon">⌕</div><b>Nincs ilyen állapotú tétel</b><div className="label">Válassz másik szűrőt.</div></div>:
    <div className="digital-binder">
      {filteredDocs.map(doc=>{
        const open=openDocId===doc.id;
        const isCard=cardKinds.has(doc.kind);
        return <article className={"binder-item "+(open?"open":"")} key={doc.id}>
          <button className="binder-tab" onClick={()=>setOpenDocId(open?null:doc.id)}>
            <div className="doc-kind-icon">{kindIcon(doc.kind)}</div>
            <div className="grow binder-main"><b>{doc.title}</b><span>{doc.metadata?.issuer||doc.member_name}{doc.metadata?.last4?" · •••• "+doc.metadata.last4:""}</span></div>
            <div className="binder-status">{expiryBadge(doc)}<span className="binder-chevron">{open?"⌃":"⌄"}</span></div>
          </button>
          {open&&<div className="binder-content">
            {(()=>{
              const pages=doc.pages||[];
              const current=Math.min(pageByDoc[doc.id]||0,Math.max(0,pages.length-1));
              const photo=pages[current];
              return photo?<div className={"document-viewer "+(isCard||cardVisualKinds.has(doc.kind)?"card-viewer":"paper-viewer")}>
                <div className="document-stage">
                  <img src={photo.imageUrl} alt={doc.title+" "+(current+1)+". oldal"}/>
                  {pages.length>1&&<>
                    <button className="page-arrow prev" disabled={current===0} onClick={()=>setPageByDoc(v=>({...v,[doc.id]:Math.max(0,current-1)}))}>‹</button>
                    <button className="page-arrow next" disabled={current===pages.length-1} onClick={()=>setPageByDoc(v=>({...v,[doc.id]:Math.min(pages.length-1,current+1)}))}>›</button>
                  </>}
                </div>
                <div className="page-indicator">
                  <span>{isCard?(current===0?"Előlap":current===1?"Hátlap":(current+1)+". oldal"):(current+1)+". oldal"} · {current+1}/{pages.length}</span>
                  <div className="page-dots">{pages.map((_,i)=><button key={i} className={i===current?"on":""} onClick={()=>setPageByDoc(v=>({...v,[doc.id]:i}))} aria-label={(i+1)+". oldal"}/>)}</div>
                </div>
                <div className="document-actions">
                  <button className="ghost-btn" onClick={()=>window.open(photo.imageUrl,"_blank")}>Teljes méret</button>
                  <button className="ghost-btn" onClick={()=>{setPrintSelected({[doc.id]:(doc.pages||[]).map((_,i)=>i)});setPrintStep("preview");setPrintOpen(true);}}>Nyomtatás</button>
                </div>
              </div>:null;
            })()}
            <div className="binder-details">
              <div><span>Tulajdonos</span><b>{doc.member_name}</b></div>
              <div><span>Lejárat</span><b>{formatDocDate(doc.expiry_date)}</b></div>
              <div><span>Oldalak</span><b>{doc.pages?.length||1}</b></div>
            </div>
            {doc.metadata?.codeValue&&doc.metadata.codeType==="qr"&&<div className="stored-code-card"><div className="qr-wrap"><QRCode value={doc.metadata.codeValue} size={148} bgColor="#FFFFFF" fgColor="#0B0F14"/></div><div><b>QR-kód</b><span>{doc.metadata.codeValue}</span></div></div>}
            {doc.metadata?.codeValue&&doc.metadata.codeType==="barcode"&&<div className="stored-code-card barcode-value"><div><b>Vonalkód azonosító</b><span>{doc.metadata.codeValue}</span></div></div>}
            {doc.note&&<div className="doc-note">{doc.note}</div>}
            <button className="doc-delete" onClick={()=>deleteDocument(doc)}>Irat törlése</button>
          </div>}
        </article>;
      })}
    </div>}

  </div>
}
type FinanceTransaction={
  id:string;booked_at:string;amount_huf:string|number;merchant:string|null;description:string|null;category:string|null;is_business:boolean;
};
type FinanceSlice={name:string;amount_huf:string|number;count:number};
type FinanceData={
  month:string;
  totals?:{income_huf:string|number;expense_huf:string|number;count:number};
  transactions?:FinanceTransaction[];
  categories?:FinanceSlice[];
  merchants?:FinanceSlice[];
  incomeBreakdown?:FinanceSlice[];
  availableMonths?:{month:string;count:number}[];
};

function normalizeCsvHeader(value:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
function parseCsvLine(line:string,separator:string){
  const out:string[]=[];let cur="";let quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;
    }else if(ch===separator&&!quoted){out.push(cur.trim());cur="";}
    else cur+=ch;
  }
  out.push(cur.trim());
  return out;
}
function csvDate(value:string){
  const v=value.trim();
  let m=v.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if(m)return m[1]+"-"+m[2].padStart(2,"0")+"-"+m[3].padStart(2,"0");
  m=v.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if(m)return m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");
  return "";
}
function csvAmount(value:string){
  const cleaned=value.replace(/HUF|Ft/gi,"").replace(/\s/g,"").replace(/\./g,"").replace(",",".").replace(/[^0-9+.-]/g,"");
  const n=Number(cleaned);return Number.isFinite(n)?n:0;
}
function parseBankCsv(text:string){
  const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());
  if(lines.length<2)return [];
  const separator=(lines[0].match(/;/g)||[]).length>=(lines[0].match(/,/g)||[]).length?";":",";
  const headers=parseCsvLine(lines[0],separator).map(normalizeCsvHeader);
  const find=(terms:string[])=>headers.findIndex(h=>terms.some(t=>h.includes(t)));
  const dateI=find(["konyveles datum","konyvelesi datum","datum","date"]);
  const amountI=find(["osszeg","amount"]);
  const debitI=find(["terheles","debit"]);
  const creditI=find(["jovairas","credit"]);
  const descI=find(["kozlemeny","leiras","megjegyzes","description","tranzakcio"]);
  const merchantI=find(["partner neve","partner","kereskedo","merchant","kedvezmenyezett"]);
  const idI=find(["azonosito","tranzakcio id","reference","referencia"]);
  if(dateI<0||(amountI<0&&debitI<0&&creditI<0))return [];
  return lines.slice(1).map(line=>{
    const cells=parseCsvLine(line,separator);
    const bookedAt=csvDate(cells[dateI]||"");
    let amountHuf=amountI>=0?csvAmount(cells[amountI]||""):0;
    if(amountI<0){
      const debit=debitI>=0?Math.abs(csvAmount(cells[debitI]||"")):0;
      const credit=creditI>=0?Math.abs(csvAmount(cells[creditI]||"")):0;
      amountHuf=credit>0?credit:-debit;
    }
    return {bookedAt,amountHuf,merchant:merchantI>=0?cells[merchantI]||"":"" ,description:descI>=0?cells[descI]||"":"",externalId:idI>=0?cells[idI]||undefined:undefined};
  }).filter(x=>x.bookedAt&&x.amountHuf!==0);
}

type BankConnectionState={
  configured:boolean;
  connection?:{status:string;account_ids?:string[];last_sync_at?:string|null;last_error?:string|null}|null;
};

function Finance() {
  const now=new Date();
  const [month,setMonth]=useState(now.toISOString().slice(0,7));
  const [view,setView]=useState<"purpose"|"merchant">("purpose");
  const [data,setData]=useState<FinanceData|null>(null);
  const [loading,setLoading]=useState(true);
  const [importing,setImporting]=useState(false);
  const [message,setMessage]=useState("");
  const [bank,setBank]=useState<BankConnectionState|null>(null);
  const [bankBusy,setBankBusy]=useState(false);
  const autoSyncRef=useRef(false);
  const fileRef=useRef<HTMLInputElement>(null);

  async function load(){
    setLoading(true);
    try{
      const res=await fetch("/api/finance/transactions?month="+encodeURIComponent(month),{cache:"no-store"});
      const json=await res.json();
      if(!res.ok)throw new Error(json.error||"Nem sikerült betölteni.");
      setData(json);
    }catch(e){setMessage(e instanceof Error?e.message:"Betöltési hiba.");}
    finally{setLoading(false);}
  }
  async function loadBank(){
    try{
      const res=await fetch("/api/finance/enablebanking",{cache:"no-store"});
      const json=await res.json();
      if(res.ok)setBank(json);
    }catch{}
  }
  useEffect(()=>{void load();},[month]);
  useEffect(()=>{void loadBank();},[]);

  async function connectBank(){
    setBankBusy(true);setMessage("OTP kapcsolat indítása…");
    try{
      const res=await fetch("/api/finance/enablebanking",{method:"POST"});
      const json=await res.json();
      if(!res.ok)throw new Error(json.error||"Nem sikerült elindítani az OTP kapcsolatot.");
      window.location.href=json.url;
    }catch(e){
      setMessage(e instanceof Error?e.message:"OTP kapcsolat hiba.");
      setBankBusy(false);
    }
  }

  async function syncBank(silent=false){
    setBankBusy(true);if(!silent)setMessage("OTP tranzakciók frissítése…");
    try{
      const res=await fetch("/api/finance/enablebanking/sync",{method:"POST"});
      const json=await res.json();
      if(!res.ok)throw new Error(json.error||"A banki szinkron nem sikerült.");
      if(!silent)setMessage("OTP szinkron kész: "+json.inserted+" új tranzakció.");
      await Promise.all([load(),loadBank()]);
    }catch(e){setMessage(e instanceof Error?e.message:"OTP szinkron hiba.");}
    finally{setBankBusy(false);}
  }

  async function importCsv(file:File){
    setImporting(true);setMessage("Banki kivonat feldolgozása…");
    try{
      const text=await file.text();
      const transactions=parseBankCsv(text);
      if(!transactions.length)throw new Error("Nem találtam felismerhető dátum + összeg oszlopokat a CSV-ben.");
      const res=await fetch("/api/finance/transactions",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({source:file.name.toLowerCase().includes("otp")?"otp-csv":"bank-csv",transactions})
      });
      const json=await res.json();
      if(!res.ok)throw new Error(json.error||"Az import nem sikerült.");
      setMessage("Import kész: "+json.inserted+" új tranzakció, "+json.skipped+" kihagyva.");
      await load();
    }catch(e){setMessage(e instanceof Error?e.message:"Import hiba.");}
    finally{setImporting(false);if(fileRef.current)fileRef.current.value="";}
  }

  useEffect(()=>{
    const connection=bank?.connection;
    const linkedNow=connection?.status==="LN"||Boolean(connection?.account_ids?.length);
    if(!linkedNow||autoSyncRef.current||bankBusy)return;
    const last=connection?.last_sync_at?new Date(connection.last_sync_at).getTime():0;
    if(last&&Date.now()-last<6*60*60*1000)return;
    autoSyncRef.current=true;
    void syncBank(true);
  },[bank?.connection?.status,bank?.connection?.last_sync_at]);

  const income=Number(data?.totals?.income_huf||0);
  const expense=Number(data?.totals?.expense_huf||0);
  const balance=income-expense;
  const slices=(view==="purpose"?data?.categories:data?.merchants)||[];
  const total=slices.reduce((sum,x)=>sum+Number(x.amount_huf||0),0);
  const colors=["#3B82F6","#22D3EE","#22C55E","#F59E0B","#8B5CF6","#EF4444","#60A5FA","#64748B"];
  let cursor=0;
  const stops=slices.map((x,i)=>{
    const pct=total?Number(x.amount_huf||0)/total*100:0;
    const from=cursor;cursor+=pct;
    return colors[i%colors.length]+" "+from+"% "+cursor+"%";
  }).join(", ");
  const monthLabel=new Date(month+"-01T00:00:00").toLocaleDateString("hu-HU",{year:"numeric",month:"long"});

  const linked=bank?.connection?.status==="AUTHORIZED"||Boolean(bank?.connection?.account_ids?.length);
  const lastSync=bank?.connection?.last_sync_at?new Date(bank.connection.last_sync_at).toLocaleString("hu-HU"):null;

  return <div className="page finance-v3">
    <Header title="Pénzügyek"/>
    <div className={"card openbanking-card "+(linked?"active":"")}>
      <div className="row between openbanking-head">
        <div className="row"><Icon tone={linked?"green":""}>O</Icon><div><b>OTP automatikus kapcsolat</b><div className="label">{linked?"Kapcsolva · a költések és bevételek automatikusan frissíthetők":bank?.configured?"Biztonságos Enable Banking kapcsolat":"Enable Banking alkalmazáskulcs beállítása szükséges"}</div></div></div>
        <span className={"badge "+(linked?"green":"amber")}>{linked?"Kapcsolva":"Nincs kapcsolat"}</span>
      </div>
      <div className="openbanking-actions">
        {!linked?<button className="primary-btn" disabled={bankBusy||!bank?.configured} onClick={()=>void connectBank()}>{bankBusy?"Kapcsolódás…":"OTP összekapcsolása"}</button>:
        <button className="primary-btn" disabled={bankBusy} onClick={()=>void syncBank(false)}>{bankBusy?"Frissítés…":"↻ OTP frissítés"}</button>}
        {lastSync&&<span className="label">Utolsó szinkron: {lastSync}</span>}
      </div>
    </div>

    <div className="finance-period card">
      <div className="row between"><div><b>Időszak</b><div className="label">{monthLabel}</div></div><span className="badge">{data?.totals?.count||0} tranzakció</span></div>
      {(()=>{
        const available=(data?.availableMonths||[]).map(x=>x.month);
        const years=Array.from(new Set(available.map(x=>x.slice(0,4)))).sort((a,b)=>Number(b)-Number(a));
        const selectedYear=month.slice(0,4);
        const monthNames=["Jan","Feb","Már","Ápr","Máj","Jún","Júl","Aug","Szept","Okt","Nov","Dec"];
        const monthsForYear=available.filter(x=>x.startsWith(selectedYear+"-"));
        return <>
          <div className="chips finance-year-chips">
            {(years.length?years:[selectedYear]).map(y=><button key={y} className={"chip "+(selectedYear===y?"on":"")} onClick={()=>{
              const candidate=available.find(x=>x.startsWith(y+"-"));
              if(candidate)setMonth(candidate);
            }}>{y}</button>)}
          </div>
          <div className="finance-month-grid">
            {monthsForYear.map(m=>{
              const n=Number(m.slice(5,7));
              const c=data?.availableMonths?.find(x=>x.month===m)?.count||0;
              return <button key={m} className={month===m?"on":""} onClick={()=>setMonth(m)}>{monthNames[n-1]} <small>{c}</small></button>
            })}
          </div>
        </>;
      })()}
    </div>
    <div className="finance-top-row finance-import-row">
      <button className="primary-btn compact" disabled={importing} onClick={()=>fileRef.current?.click()}>{importing?"Import…":"＋ Banki CSV import"}</button>
      <input ref={fileRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={e=>{const file=e.target.files?.[0];if(file)void importCsv(file);}}/>
    </div>
    {message&&<div className="auth-message">{message}</div>}

    <div className="section-title">{monthLabel} · pénzügyi kép</div>
    <div className="grid finance-kpis">
      <div className="card"><div className="label">Beérkezett pénz</div><div className="metric finance-positive">{money(income)}</div><div className="delta">Egyéb bevétel is ide kerül</div></div>
      <div className="card"><div className="label">Kiadás</div><div className="metric">{money(expense)}</div><div className="delta down">{data?.totals?.count||0} banki tranzakció</div></div>
      <div className={"card "+(balance>=0?"active":"")}><div className="label">Havi egyenleg</div><div className="metric">{money(balance)}</div><div className="delta">{balance>=0?"Pozitív hónap":"Több kiadás, mint bevétel"}</div></div>
    </div>

    <div className="section-title">Kiadási megoszlás</div>
    <div className="card spending-overview">
      <div className="tabs revenue-view-tabs">
        <button className={"tab "+(view==="purpose"?"on":"")} onClick={()=>setView("purpose")}>Mire költök?</button>
        <button className={"tab "+(view==="merchant"?"on":"")} onClick={()=>setView("merchant")}>Hol költök?</button>
      </div>
      {loading?<div className="nav-loading"><div className="security-v2-loader"/><span>Tranzakciók betöltése…</span></div>:
      slices.length===0?<div className="spending-empty-layout">
        <div className={"spending-donut-empty "+(view==="merchant"?"merchant":"")}><div><b>— Ft</b><span>nincs adat</span></div></div>
        <div className="spending-empty-copy"><b>Még nincs banki tranzakció</b><p>{linked?"Nyomj egy OTP frissítést, és a tranzakciók automatikusan ide kerülnek.":"Kapcsold össze az OTP-t, vagy tartalékként importálj banki CSV kivonatot."}</p></div>
      </div>:
      <div className="revenue-share-layout">
        <div className="revenue-donut" style={{background:"conic-gradient("+(stops||"#243044 0 100%")+")"}}>
          <div className="revenue-donut-hole"><b>{money(total)}</b><span>{view==="purpose"?"kiadás":"elköltve"}</span></div>
        </div>
        <div className="revenue-legend">{slices.slice(0,8).map((x,i)=>{
          const pct=total?Math.round(Number(x.amount_huf||0)/total*100):0;
          return <div className="revenue-legend-row" key={x.name}><span className="revenue-swatch" style={{background:colors[i%colors.length]}}/><b>{x.name}</b><span>{money(x.amount_huf)}</span><small>{pct}% · {x.count} db</small></div>
        })}</div>
      </div>}
    </div>

    <div className="section-title">Bevételek</div>
    <div className="card finance-income-list">
      {(data?.incomeBreakdown||[]).length===0?<div className="label">Ebben a hónapban nincs beérkező banki tranzakció.</div>:(data?.incomeBreakdown||[]).map(x=><div className="row between finance-income-row" key={x.name}><div><b>{x.name}</b><div className="label">{x.count} tranzakció</div></div><b className="finance-positive">+{money(x.amount_huf)}</b></div>)}
    </div>

    <div className="section-title">Legutóbbi tranzakciók</div>
    <div className="card finance-transactions-scroll">
      {(data?.transactions||[]).length===0?<div className="label">Még nincs importált tranzakció ebben a hónapban.</div>:(data?.transactions||[]).map(tx=><div className="finance-transaction-row" key={tx.id}>
        <div className="grow"><b>{tx.merchant||tx.description||"Banki tranzakció"}</b><div className="label">{new Date(tx.booked_at+"T00:00:00").toLocaleDateString("hu-HU")} · {tx.category||"Egyéb"}</div></div>
        <b className={Number(tx.amount_huf)>0?"finance-positive":"finance-negative"}>{Number(tx.amount_huf)>0?"+":""}{money(tx.amount_huf)}</b>
      </div>)}
    </div>

    <div className="card finance-bank-note">
      <div className="row"><Icon>N</Icon><div><b>Biztonságos bankkapcsolat</b><div className="label">Az engedélyezés az Enable Banking és az OTP saját felületén történik. Az app csak olvasási jogosultságot kap; OTP-jelszót nem tárolunk. A CSV import tartalék lehetőség marad.</div></div></div>
    </div>
  </div>
}
type NavInvoiceRow={
  id:string;
  invoice_number:string|null;
  partner_name:string|null;
  issue_date:string;
  paid_at:string|null;
  net_amount_huf:string|number|null;
  vat_amount_huf:string|number|null;
  gross_amount_huf:string|number;
  status:string;
  currency:string;
  customer_tax_number:string|null;
  invoice_category:string|null;
  payment_method:string|null;
  payment_date:string|null;
  invoice_delivery:string|null;
  invoice_appearance:string|null;
  invoice_operation:string|null;
  original_invoice_number:string|null;
  nav_source:string|null;
};
type NavSummary={
  issued_count:number;
  issued_gross_huf:string|number;
  modify_count:number;
  storno_count:number;
  customer_count:number;
  average_gross_huf:string|number;
  paid_count:number;
};
type NavInvoiceData={
  configured:boolean;
  businessName?:string;
  taxNumber?:string;
  lastSyncAt?:string|null;
  lastSyncStatus?:string|null;
  lastError?:string|null;
  summary?:NavSummary|null;
  monthly?:{month:string;count:number;gross_huf:string|number}[];
  quarterly?:{year:number;quarter:number;count:number;gross_huf:string|number;avg_huf:string|number}[];
  topCustomers?:{name:string;count:number;gross_huf:string|number}[];
  paymentMethods?:{method:string;count:number;gross_huf:string|number}[];
  allYears?:{year:number;count:number;gross_huf:string|number;avg_huf:string|number;customers:number}[];
  allMonthly?:{year:number;month:number;count:number;gross_huf:string|number}[];
  allInvoices?:NavInvoiceRow[];
  invoices?:NavInvoiceRow[];
};

function money(value:unknown){
  const n=Number(value??0);
  return new Intl.NumberFormat("hu-HU",{maximumFractionDigits:0}).format(Number.isFinite(n)?n:0)+" Ft";
}
function prettyMethod(value:string|null){
  if(!value) return "Nincs megadva";
  const map:Record<string,string>={CASH:"Készpénz",TRANSFER:"Átutalás",CARD:"Bankkártya",VOUCHER:"Utalvány",OTHER:"Egyéb"};
  return map[value]||value;
}
function prettyOperation(value:string|null){
  const map:Record<string,string>={CREATE:"Kiállított",MODIFY:"Módosítás",STORNO:"Stornó"};
  return map[value||""]||value||"Kiállított";
}

function invoiceMonth(issueDate:string){
  const raw=String(issueDate||"");
  const m=Number(raw.slice(5,7));
  return Number.isFinite(m)&&m>=1&&m<=12?m:0;
}

function IssuedInvoiceCenter({navMode=false}:{navMode?:boolean}){
  const currentYear=new Date().getFullYear();
  const [year,setYear]=useState(currentYear);
  const [data,setData]=useState<NavInvoiceData|null>(null);
  const [loading,setLoading]=useState(true);
  const [syncing,setSyncing]=useState(false);
  const [q,setQ]=useState("");
  const [op,setOp]=useState<"ALL"|"CREATE"|"MODIFY"|"STORNO">("ALL");
  const [selected,setSelected]=useState<NavInvoiceRow|null>(null);
  const [showConfig,setShowConfig]=useState(false);
  const [message,setMessage]=useState("");
  const [periodMode,setPeriodMode]=useState<"year"|"quarter"|"months">("year");
  const [overviewMode,setOverviewMode]=useState<"share"|"years"|"run">("share");
  const [quarter,setQuarter]=useState(Math.floor(new Date().getMonth()/3)+1);
  const [months,setMonths]=useState<number[]>([]);
  const [form,setForm]=useState({businessName:"Egyéni vállalkozás",taxNumber:"",login:"",password:"",signKey:""});

  async function load(search=q){
    setLoading(true);
    try{
      const res=await fetch(`/api/nav/invoices?year=${year}&q=${encodeURIComponent(search)}`,{cache:"no-store"});
      const json=await res.json();
      if(!res.ok) throw new Error(json.error||"Nem sikerült betölteni a számlákat.");
      setData(json);
      if(json.configured){
        setForm(v=>({...v,businessName:json.businessName||v.businessName,taxNumber:json.taxNumber||v.taxNumber}));
      }
    }catch(e){setMessage(e instanceof Error?e.message:"Betöltési hiba.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{void load("");},[year]);

  async function saveConfig(){
    setMessage("NAV kapcsolat mentése…");
    const res=await fetch("/api/nav/config",{
      method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(form)
    });
    const json=await res.json();
    if(!res.ok){setMessage(json.error||"Nem sikerült menteni.");return;}
    setShowConfig(false);
    setForm(v=>({...v,login:"",password:"",signKey:""}));
    setMessage("NAV kapcsolat elmentve. Most szinkronizálhatod a számlákat.");
    await load("");
  }

  async function sync(){
    setSyncing(true);
    try{
      const known=(data?.allYears||[]).map(x=>Number(x.year)).filter(Number.isFinite);
      const earliest=known.length?Math.min(...known):Math.max(2021,currentYear-2);
      const yearsToSync=Array.from({length:currentYear-earliest+1},(_,i)=>earliest+i);
      let seen=0;

      for(let i=0;i<yearsToSync.length;i++){
        const y=yearsToSync[i];
        setMessage(`NAV frissítés: ${y} (${i+1}/${yearsToSync.length})…`);
        const today=new Date();
        const to=y===currentYear?today.toISOString().slice(0,10):`${y}-12-31`;
        const res=await fetch("/api/nav/invoices",{
          method:"POST",headers:{"content-type":"application/json"},
          body:JSON.stringify({from:`${y}-01-01`,to})
        });
        const json=await res.json();
        if(!res.ok) throw new Error(json.error||`${y}: a NAV szinkron nem sikerült.`);
        seen+=Number(json.seen||0);
      }

      setMessage(`Teljes NAV frissítés kész: ${yearsToSync[0]}–${yearsToSync.at(-1)}, ${seen} tétel feldolgozva.`);
      await load(q);
    }catch(e){setMessage(e instanceof Error?e.message:"NAV szinkron hiba.");}
    finally{setSyncing(false);}
  }

  function inSelectedPeriod(inv:NavInvoiceRow){
    const m=invoiceMonth(inv.issue_date);
    if(periodMode==="quarter") return Math.ceil(m/3)===quarter;
    if(periodMode==="months"&&months.length) return months.includes(m);
    return true;
  }

  const yearInvoices=data?.invoices||[];
  const quarterCounts=[1,2,3,4].map(qr=>({
    quarter:qr,
    count:yearInvoices.filter(x=>x.invoice_operation==="CREATE"&&Math.ceil(invoiceMonth(x.issue_date)/3)===qr).length
  }));
  const monthCounts=Array.from({length:12},(_,i)=>({
    month:i+1,
    count:yearInvoices.filter(x=>x.invoice_operation==="CREATE"&&invoiceMonth(x.issue_date)===(i+1)).length
  }));

  useEffect(()=>{
    if(periodMode!=="quarter"||!data?.invoices?.length) return;
    const current=quarterCounts.find(x=>x.quarter===quarter)?.count||0;
    if(current>0) return;
    const latest=[...quarterCounts].reverse().find(x=>x.count>0);
    if(latest) setQuarter(latest.quarter);
  },[data?.invoices,periodMode,year]);

  useEffect(()=>{
    if(periodMode!=="months"||!data?.invoices?.length) return;
    const selectedHasData=months.some(m=>(monthCounts.find(x=>x.month===m)?.count||0)>0);
    if(selectedHasData) return;
    const latest=[...monthCounts].reverse().find(x=>x.count>0);
    if(latest) setMonths([latest.month]);
  },[data?.invoices,periodMode,year]);

  const periodRows=(data?.invoices||[]).filter(inSelectedPeriod);
  const createRows=periodRows.filter(x=>x.invoice_operation==="CREATE");
  const invoiceHistory=(data?.allInvoices||data?.invoices||[]);
  const invoices=invoiceHistory.filter(x=>op==="ALL"||x.invoice_operation===op);
  const selectedGross=createRows.reduce((sum,x)=>sum+Number(x.gross_amount_huf||0),0);
  const selectedAvg=createRows.length?selectedGross/createRows.length:0;
  const selectedCustomers=new Set(createRows.map(x=>x.partner_name).filter(Boolean)).size;
  const selectedModify=periodRows.filter(x=>x.invoice_operation==="MODIFY").length;
  const selectedStorno=periodRows.filter(x=>x.invoice_operation==="STORNO").length;

  const monthBuckets=Array.from({length:12},(_,i)=>{
    const rows=createRows.filter(x=>invoiceMonth(x.issue_date)===(i+1));
    const gross=rows.reduce((sum,x)=>sum+Number(x.gross_amount_huf||0),0);
    return {month:i+1,count:rows.length,gross,avg:rows.length?gross/rows.length:0};
  });
  const visibleMonths=monthBuckets.filter(m=>periodMode!=="months"||months.length===0||months.includes(m.month));
  const maxMonth=Math.max(1,...visibleMonths.map(x=>x.gross));
  const maxCount=Math.max(1,...visibleMonths.map(x=>x.count));
  const maxAvg=Math.max(1,...visibleMonths.map(x=>x.avg));

  const customerMap=new Map<string,{count:number;gross:number}>();
  for(const inv of createRows){
    const name=inv.partner_name||"Magánszemély / nincs név";
    const cur=customerMap.get(name)||{count:0,gross:0};
    cur.count++;cur.gross+=Number(inv.gross_amount_huf||0);customerMap.set(name,cur);
  }
  const topCustomers=Array.from(customerMap.entries()).map(([name,v])=>({name,...v})).sort((a,b)=>b.gross-a.gross).slice(0,6);
  const maxCustomer=Math.max(1,...topCustomers.map(x=>x.gross));

  const paymentMap=new Map<string,{count:number;gross:number}>();
  for(const inv of createRows){
    const method=prettyMethod(inv.payment_method);
    const cur=paymentMap.get(method)||{count:0,gross:0};
    cur.count++;cur.gross+=Number(inv.gross_amount_huf||0);paymentMap.set(method,cur);
  }
  const paymentRows=Array.from(paymentMap.entries()).map(([name,v])=>({name,...v})).sort((a,b)=>b.gross-a.gross);
  const totalPayment=Math.max(1,paymentRows.reduce((s,x)=>s+x.gross,0));

  const years=(data?.allYears||[]).slice().sort((a,b)=>a.year-b.year);
  const availableYears=years.slice().sort((a,b)=>b.year-a.year).map(x=>x.year);
  const allMonthly=data?.allMonthly||[];
  const maxYear=Math.max(1,...years.map(x=>Number(x.gross_huf||0)));
  const totalAllRevenue=years.reduce((sum,x)=>sum+Number(x.gross_huf||0),0);
  const totalAllInvoices=years.reduce((sum,x)=>sum+Number(x.count||0),0);
  const yearColors=["#3B82F6","#22D3EE","#22C55E","#F59E0B","#EF4444","#8B5CF6"];
  let shareCursor=0;
  const shareStops=years.map((y,i)=>{
    const share=totalAllRevenue?Number(y.gross_huf||0)/totalAllRevenue*100:0;
    const start=shareCursor;shareCursor+=share;
    return `${yearColors[i%yearColors.length]} ${start}% ${shareCursor}%`;
  }).join(", ");
  const runSeries=years.map((y,i)=>{
    let cumulative=0;
    const values=Array.from({length:12},(_,m)=>{
      const row=allMonthly.find(x=>Number(x.year)===Number(y.year)&&Number(x.month)===m+1);
      cumulative+=Number(row?.gross_huf||0);
      return cumulative;
    });
    return {year:Number(y.year),color:yearColors[i%yearColors.length],values};
  });
  const maxRun=Math.max(1,...runSeries.flatMap(x=>x.values));
  const monthNames=["Jan","Feb","Már","Ápr","Máj","Jún","Júl","Aug","Szept","Okt","Nov","Dec"];
  const periodLabel=periodMode==="year"
    ?`${year}. teljes év`
    :periodMode==="quarter"
      ?`${year} Q${quarter}`
      :months.length
        ?`${year} · ${months.map(m=>monthNames[m-1]).join(", ")}`
        :`${year} · válassz hónapokat`;

  useEffect(()=>{
    if(!data?.configured||!availableYears.length) return;
    if(!availableYears.includes(year)) setYear(availableYears[0]);
  },[data?.allYears]);

  if(loading&&!data) return <div className="card nav-loading"><div className="security-v2-loader"/><span>NAV számlák betöltése…</span></div>;

  if(!data?.configured){
    return <div className="nav-connect-wrap">
      <div className="card nav-connect-card active">
        <div className="row between"><Icon>N</Icon><span className="badge amber">Kapcsolat szükséges</span></div>
        <h2>Online Számla kapcsolat</h2>
        <p className="subtle">A kiállított számláid automatikus lekéréséhez egyszer kell megadni a NAV technikai felhasználót. Az adatok titkosítva kerülnek tárolásra.</p>
        <button className="primary-btn" onClick={()=>setShowConfig(true)}>NAV kapcsolat beállítása</button>
      </div>
      {showConfig&&<div className="card nav-config-card">
        <div className="row between"><div><b>NAV technikai felhasználó</b><div className="label">Ezeket ne küldd el chatben — itt add meg.</div></div><button className="ghost-btn" onClick={()=>setShowConfig(false)}>Bezárás</button></div>
        <div className="form-card" style={{marginTop:12}}>
          <input className="input" placeholder="Vállalkozás neve" value={form.businessName} onChange={e=>setForm({...form,businessName:e.target.value})}/>
          <input className="input" inputMode="numeric" placeholder="Adószám első 8 számjegye" value={form.taxNumber} onChange={e=>setForm({...form,taxNumber:e.target.value})}/>
          <input className="input" autoCapitalize="none" placeholder="Technikai felhasználó login" value={form.login} onChange={e=>setForm({...form,login:e.target.value})}/>
          <input className="input" type="password" placeholder="Technikai felhasználó jelszó" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
          <input className="input" type="password" placeholder="Aláírókulcs" value={form.signKey} onChange={e=>setForm({...form,signKey:e.target.value})}/>
          <button className="primary-btn" onClick={saveConfig}>Titkosítva mentés</button>
        </div>
      </div>}
      {message&&<div className="auth-message">{message}</div>}
    </div>;
  }

  return <div className="nav-invoice-center">
    <div className="nav-syncbar card">
      <div>
        <div className="row"><span className={"nav-live-dot "+(data.lastSyncStatus==="error"?"error":"")}/><b>{data.businessName}</b></div>
        <div className="label">{data.taxNumber} · {data.lastSyncAt?"Utolsó szinkron: "+new Date(data.lastSyncAt).toLocaleString("hu-HU"):"Még nem volt szinkron"}</div>
      </div>
      <div className="nav-sync-actions">
        <button className="ghost-btn" onClick={()=>setShowConfig(v=>!v)}>Kapcsolat módosítása</button>
        <button className="primary-btn compact" disabled={syncing} onClick={sync}>{syncing?"Összes év frissítése…":"↻ Teljes NAV frissítés"}</button>
      </div>
    </div>

    {showConfig&&<div className="card nav-config-card">
      <div className="row between">
        <div><b>NAV kapcsolat módosítása</b><div className="label">Az adószámot átírhatod. A titkos mezőket hagyd üresen, ha nem változtak.</div></div>
        <button className="ghost-btn" onClick={()=>setShowConfig(false)}>Bezárás</button>
      </div>
      <div className="form-card" style={{marginTop:12}}>
        <input className="input" placeholder="Vállalkozás neve" value={form.businessName} onChange={e=>setForm({...form,businessName:e.target.value})}/>
        <input className="input" inputMode="numeric" placeholder="Adószám első 8 számjegye" value={form.taxNumber} onChange={e=>setForm({...form,taxNumber:e.target.value.replace(/\D/g,"").slice(0,8)})}/>
        <input className="input" autoCapitalize="none" placeholder="Technikai felhasználó login — csak ha változott" value={form.login} onChange={e=>setForm({...form,login:e.target.value})}/>
        <input className="input" type="password" placeholder="Technikai jelszó — csak ha változott" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
        <input className="input" type="password" placeholder="XML aláírókulcs — csak ha változott" value={form.signKey} onChange={e=>setForm({...form,signKey:e.target.value})}/>
        <button className="primary-btn" onClick={saveConfig}>Módosítás mentése</button>
      </div>
    </div>}

    {message&&<div className="auth-message">{message}</div>}
    {data.lastError&&<div className="security-v2-message">Legutóbbi NAV hiba: {data.lastError}</div>}

    <div className="nav-period card">
      <div className="row between"><div><b>Időszak</b><div className="label">{periodLabel}</div></div><span className="badge">Elemzés</span></div>
      <div className="tabs nav-period-tabs">
        <button className={"tab "+(periodMode==="year"?"on":"")} onClick={()=>setPeriodMode("year")}>Év</button>
        <button className={"tab "+(periodMode==="quarter"?"on":"")} onClick={()=>setPeriodMode("quarter")}>Negyedév</button>
        <button className={"tab "+(periodMode==="months"?"on":"")} onClick={()=>setPeriodMode("months")}>Hónapok</button>
      </div>
      <div className="chips nav-year-chips">
        {(availableYears.length?availableYears:[currentYear]).map(y=><button key={y} className={"chip "+(year===y?"on":"")} onClick={()=>setYear(y)}>{y}</button>)}
      </div>
      {periodMode==="quarter"&&<div className="chips nav-quarter-chips">
        {quarterCounts.map(({quarter:v,count})=><button key={v} className={"chip "+(quarter===v?"on":"")} onClick={()=>setQuarter(v)}>Q{v} <small>{count}</small></button>)}
      </div>}
      {periodMode==="months"&&<div className="nav-month-picker">
        {monthNames.map((name,i)=>{
          const value=i+1;const on=months.includes(value);
          const count=monthCounts[i]?.count||0;
          return <button key={name} className={on?"on":""} onClick={()=>setMonths(m=>on?m.filter(x=>x!==value):[...m,value].sort((a,b)=>a-b))}>{name}<small>{count}</small></button>
        })}
      </div>}
    </div>

    <div className="grid nav-kpi-grid">
      <div className="card active"><div className="label">Kiállított számlák</div><div className="metric">{createRows.length} db</div><div className="delta">{periodLabel}</div></div>
      <div className="card"><div className="label">Kiszámlázott bruttó</div><div className="metric">{money(selectedGross)}</div><div className="delta">{selectedCustomers} vevő</div></div>
      <div className="card"><div className="label">Átlagos számla</div><div className="metric">{money(selectedAvg)}</div><div className="delta">{createRows.length?"Valós NAV adatok":"Nincs adat"}</div></div>
      <div className="card"><div className="label">Módosítás / stornó</div><div className="metric">{selectedModify+selectedStorno} db</div><div className="delta down">{selectedModify} mód. · {selectedStorno} stornó</div></div>
    </div>

    <div className="section-title">Kiállított számlák</div>
    <div className="nav-toolbar">
      <div className="nav-search"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void load(q);}} placeholder="Számlaszám vagy vevő…"/><button onClick={()=>load(q)}>Keresés</button></div>
      <div className="chips">
        {(["ALL","CREATE","MODIFY","STORNO"] as const).map(value=><button key={value} className={"chip "+(op===value?"on":"")} onClick={()=>setOp(value)}>{value==="ALL"?"Mind":prettyOperation(value)}</button>)}
      </div>
    </div>

    {invoices.length===0?<div className="empty-card"><div className="empty-icon">▥</div><b>Nincs ilyen számla</b><div className="label">A lista a teljes NAV számlatörténetben keres.</div></div>:
    <div className="nav-invoice-scroll"><div className="nav-invoice-list">
      {invoices.map(inv=><button className={"nav-invoice-row "+(selected?.id===inv.id?"selected":"")} key={inv.id} onClick={()=>setSelected(inv)}>
        <div className="nav-invoice-main">
          <div className="row"><b>{inv.invoice_number||"Számla"}</b><span className={"nav-op "+(inv.invoice_operation||"").toLowerCase()}>{prettyOperation(inv.invoice_operation)}</span></div>
          <div className="nav-customer">{inv.partner_name||"Magánszemély / nincs név"}</div>
          <div className="label">{new Date(inv.issue_date).toLocaleDateString("hu-HU")} · {prettyMethod(inv.payment_method)}</div>
        </div>
        <div className="nav-invoice-amount"><b>{money(inv.gross_amount_huf)}</b><span>{inv.currency||"HUF"} · Részletek ›</span></div>
      </button>)}
    </div></div>}

    {years.length>0&&<><div className="section-title">Bevételi áttekintés</div><div className="card revenue-overview">
      <div className="row between revenue-overview-head">
        <div><div className="label">Összes eddigi kiszámlázott bevétel</div><div className="metric">{money(totalAllRevenue)}</div><div className="delta">{totalAllInvoices} számla · {years[0]?.year}–{years.at(-1)?.year}</div></div>
        <span className="badge">NAV</span>
      </div>
      <div className="tabs revenue-view-tabs">
        <button className={"tab "+(overviewMode==="share"?"on":"")} onClick={()=>setOverviewMode("share")}>Megoszlás</button>
        <button className={"tab "+(overviewMode==="years"?"on":"")} onClick={()=>setOverviewMode("years")}>Évek</button>
        <button className={"tab "+(overviewMode==="run"?"on":"")} onClick={()=>setOverviewMode("run")}>Lefutás</button>
      </div>

      {overviewMode==="share"&&<div className="revenue-share-layout">
        <div className="revenue-donut" style={{background:`conic-gradient(${shareStops||"#243044 0 100%"})`}}>
          <div className="revenue-donut-hole"><b>{money(totalAllRevenue)}</b><span>összesen</span></div>
        </div>
        <div className="revenue-legend">{years.map((y,i)=>{
          const pct=totalAllRevenue?Math.round(Number(y.gross_huf||0)/totalAllRevenue*100):0;
          return <div className="revenue-legend-row" key={y.year}>
            <span className="revenue-swatch" style={{background:yearColors[i%yearColors.length]}}/>
            <b>{y.year}</b><span>{money(y.gross_huf)}</span><small>{pct}% · {y.count} db</small>
          </div>
        })}</div>
      </div>}

      {overviewMode==="years"&&<div className="revenue-year-bars">
        {years.map((y,i)=><div className="revenue-year-col" key={y.year}>
          <div className="revenue-year-value">{money(y.gross_huf).replace(" Ft","")}</div>
          <div className="revenue-year-bar"><i style={{height:Math.max(7,Math.round(Number(y.gross_huf||0)/maxYear*100))+"%",background:yearColors[i%yearColors.length]}}/></div>
          <b>{y.year}</b><small>{y.count} számla</small>
        </div>)}
      </div>}

      {overviewMode==="run"&&<div className="revenue-run-wrap">
        <svg className="revenue-run-svg" viewBox="0 0 100 64" preserveAspectRatio="none">
          {[0,16,32,48,64].map(y=><line key={y} x1="0" x2="100" y1={y} y2={y} className="revenue-grid-line"/>)}
          {runSeries.map(series=>{
            const points=series.values.map((v,i)=>`${(i/11)*100},${64-(v/maxRun)*58}`).join(" ");
            return <polyline key={series.year} points={points} fill="none" stroke={series.color} strokeWidth="2.1" vectorEffect="non-scaling-stroke" className="revenue-run-line"/>;
          })}
        </svg>
        <div className="revenue-month-axis">{monthNames.map(m=><span key={m}>{m}</span>)}</div>
        <div className="revenue-run-legend">{runSeries.map(s=><span key={s.year}><i style={{background:s.color}}/>{s.year}</span>)}</div>
      </div>}
    </div></>}

    {topCustomers.length>0&&<><div className="section-title">Top vevők</div><div className="card analytics-rank">
      {topCustomers.map((c,i)=><div className="analytics-rank-row" key={c.name}>
        <span>{i+1}</span><div className="grow"><div className="row between"><b>{c.name}</b><small>{money(c.gross)} · {c.count} db</small></div><div className="analytics-track"><i style={{width:Math.max(4,Math.round(c.gross/maxCustomer*100))+"%"}}/></div></div>
      </div>)}
    </div></>}

    {paymentRows.length>0&&<><div className="section-title">Fizetési módok</div><div className="card payment-analytics">
      {paymentRows.map(p=><div className="payment-row" key={p.name}><div className="row between"><b>{p.name}</b><span>{Math.round(p.gross/totalPayment*100)}% · {money(p.gross)}</span></div><div className="analytics-track cyan"><i style={{width:Math.max(3,Math.round(p.gross/totalPayment*100))+"%"}}/></div></div>)}
    </div></>}

    {selected&&<div className="invoice-sheet-backdrop" onClick={()=>setSelected(null)}>
      <div className="invoice-sheet" onClick={e=>e.stopPropagation()}>
        <div className="invoice-sheet-handle"/>
        <div className="row between"><div><div className="label">NAV számlakivonat</div><h2>{selected.invoice_number}</h2></div><button className="ghost-btn" onClick={()=>setSelected(null)}>Bezárás</button></div>
        <div className="row" style={{marginTop:8}}><span className={"nav-op "+(selected.invoice_operation||"").toLowerCase()}>{prettyOperation(selected.invoice_operation)}</span><span className="badge">{selected.currency||"HUF"}</span></div>
        <div className="nav-detail-grid">
          <div><span>Vevő</span><b>{selected.partner_name||"Nincs név"}</b></div>
          <div><span>Vevő adószáma</span><b>{selected.customer_tax_number||"—"}</b></div>
          <div><span>Kiállítás</span><b>{new Date(selected.issue_date).toLocaleDateString("hu-HU")}</b></div>
          <div><span>Teljesítés</span><b>{selected.invoice_delivery?new Date(selected.invoice_delivery).toLocaleDateString("hu-HU"):"—"}</b></div>
          <div><span>Nettó</span><b>{money(selected.net_amount_huf)}</b></div>
          <div><span>ÁFA</span><b>{money(selected.vat_amount_huf)}</b></div>
          <div><span>Bruttó</span><b>{money(selected.gross_amount_huf)}</b></div>
          <div><span>Fizetési mód</span><b>{prettyMethod(selected.payment_method)}</b></div>
          <div><span>Megjelenés</span><b>{selected.invoice_appearance||"—"}</b></div>
          <div><span>Forrás</span><b>{selected.nav_source||"NAV"}</b></div>
        </div>
      </div>
    </div>}

    {navMode&&<div className="card nav-next-module">
      <div className="row"><Icon tone="amber">N</Icon><div><b>Adószámla, határidők és bevallások</b><div className="label">A részletes NAV funkciókat a felső Adószámla, Határidők és Bevallások füleken éred el.</div></div></div>
    </div>}
  </div>;
}

function Business() {
 return <div className="page"><Header title="Vállalkozás"/>
  <div className="tabs"><button className="tab on">NAV számlák</button><button className="tab">Bevétel</button><button className="tab">Partnerek</button><button className="tab">Riport</button></div>
  <IssuedInvoiceCenter/>
 </div>
}
type NavDeadline={id:string;date:string;title:string;detail:string;category:string;source:string;status:"past"|"today"|"upcoming"};
function NavDeadlines(){
 const [items,setItems]=useState<NavDeadline[]>([]);
 const [live,setLive]=useState(false);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  let active=true;
  fetch("/api/nav/deadlines",{cache:"no-store"}).then(r=>r.json()).then(data=>{
   if(!active)return;setItems(data.deadlines||[]);setLive(Boolean(data.live));
  }).catch(()=>{}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);
 const today=new Date().toISOString().slice(0,10);
 const upcoming=items.filter(x=>x.date>=today);
 const past=items.filter(x=>x.date<today).slice(-3).reverse();
 const days=(date:string)=>Math.ceil((new Date(date+"T00:00:00").getTime()-new Date(today+"T00:00:00").getTime())/86400000);
 return <div className="nav-deadlines">
  <div className="card active deadline-hero">
   <div className="row between"><div><div className="label">NAV határidők</div><h2>{upcoming[0]?new Date(upcoming[0].date+"T00:00:00").toLocaleDateString("hu-HU"):"Nincs közelgő tétel"}</h2></div><span className={"badge "+(live?"green":"amber")}>{live?"NAV élő forrás":"NAV tartalék lista"}</span></div>
   {upcoming[0]&&<><b>{upcoming[0].title}</b><div className="delta">{days(upcoming[0].date)===0?"Ma":days(upcoming[0].date)+" nap múlva"} · {upcoming[0].category}</div></>}
  </div>
  <div className="section-title">Közelgő</div>
  {loading?<div className="card nav-loading"><div className="security-v2-loader"/><span>Határidők frissítése…</span></div>:<div className="deadline-list">
   {upcoming.map(x=><div className="card deadline-row" key={x.id}><div className="deadline-date"><b>{new Date(x.date+"T00:00:00").toLocaleDateString("hu-HU",{month:"short",day:"numeric"})}</b><small>{new Date(x.date+"T00:00:00").getFullYear()}</small></div><div className="grow"><div className="row between"><b>{x.title}</b><span className="badge">{x.source}</span></div><div className="label">{x.detail}</div><div className="delta">{days(x.date)} nap múlva · {x.category}</div></div></div>)}
  </div>}
  <div className="card nav-calendar-card">
   <div><b>Személyes NAV Adónaptár</b><div className="label">A NAV Ügyfélportál a saját adózói profilod alapján mutatja a teljes, személyre szabott kötelezettséglistát.</div></div>
   <a className="primary-btn compact" href="https://ugyfelportal.nav.gov.hu/" target="_blank" rel="noreferrer">NAV Adónaptár megnyitása ↗</a>
  </div>
  {past.length>0&&<><div className="section-title">Legutóbbi határidők</div><div className="deadline-past">{past.map(x=><div className="list-item" key={x.id}><Icon tone="green">✓</Icon><div className="grow"><b>{x.title}</b><div className="label">{new Date(x.date+"T00:00:00").toLocaleDateString("hu-HU")} · {x.category}</div></div></div>)}</div></>}
 </div>
}
function NavPage(){
 const [tab,setTab]=useState<"invoices"|"account"|"deadlines"|"returns">("invoices");
 return <div className="page"><Header title="NAV"/>
  <div className="tabs nav-main-tabs">
   <button className={"tab "+(tab==="invoices"?"on":"")} onClick={()=>setTab("invoices")}>Számlák</button>
   <button className={"tab "+(tab==="account"?"on":"")} onClick={()=>setTab("account")}>Adószámla</button>
   <button className={"tab "+(tab==="deadlines"?"on":"")} onClick={()=>setTab("deadlines")}>Határidők</button>
   <button className={"tab "+(tab==="returns"?"on":"")} onClick={()=>setTab("returns")}>Bevallások</button>
  </div>
  {tab==="invoices"&&<IssuedInvoiceCenter navMode/>}
  {tab==="deadlines"&&<NavDeadlines/>}
  {tab==="account"&&<div className="card nav-next-module"><div className="row"><Icon tone="amber">N</Icon><div><b>Adószámla</b><div className="label">A személyes adószámla NAV-azonosítást igényel; nem mutatunk kitalált egyenleget. Következő egységben importtal kötjük be.</div></div></div></div>}
  {tab==="returns"&&<div className="card nav-next-module"><div className="row"><Icon tone="amber">N</Icon><div><b>Bevallások</b><div className="label">A beadott bevallások státusza külön NAV-adatforrás. Ezt a következő egységben kötjük be.</div></div></div></div>}
 </div>
}
function Vault(){
 const [exists,setExists]=useState(false);
 const [cloudReady,setCloudReady]=useState(false);
 const [cloudPayload,setCloudPayload]=useState<StoredVault|null>(null);
 const [syncState,setSyncState]=useState<"idle"|"syncing"|"synced"|"offline">("idle");
 const [unlocked,setUnlocked]=useState(false);
 const [master,setMaster]=useState("");
 const [key,setKey]=useState<CryptoKey|null>(null);
 const [entries,setEntries]=useState<VaultEntry[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [reveal,setReveal]=useState(false);
 const [error,setError]=useState("");
 const [draft,setDraft]=useState({title:"",category:"Weboldal",url:"",username:"",password:"",pin:""});

 async function syncPayload(payload:StoredVault){
  setSyncState("syncing");
  try{
   const res=await fetch("/api/vault",{
    method:"PUT",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({payload})
   });
   if(!res.ok) throw new Error();
   setCloudPayload(payload);
   setSyncState("synced");
  }catch{
   setSyncState("offline");
  }
 }

 useEffect(()=>{
  let active=true;
  (async()=>{
   const local=getLocalVaultPayload();
   setExists(Boolean(local));
   try{
    const res=await fetch("/api/vault",{cache:"no-store"});
    const data=await res.json();
    if(!active) return;
    if(res.ok&&data.exists&&data.payload){
     const payload=data.payload as StoredVault;
     setCloudPayload(payload);
     setLocalVaultPayload(payload);
     setExists(true);
     setSyncState("synced");
    }else if(local){
     await syncPayload(local);
    }
   }catch{
    if(active&&local) setSyncState("offline");
   }finally{
    if(active) setCloudReady(true);
   }
  })();
  return()=>{active=false;};
 },[]);

 const selected=entries.find(x=>x.id===selectedId)??entries[0];

 async function open(create:boolean){
  try{
   setError("");
   if(create){
    const result=await createVault(master);
    await syncPayload(result.payload);
    setKey(result.key);setEntries(result.entries);setUnlocked(true);setExists(true);setMaster("");
    return;
   }
   const source=cloudPayload??getLocalVaultPayload();
   const result=await unlockVault(master,source);
   setKey(result.key);setEntries(result.entries);setUnlocked(true);setExists(true);setMaster("");
  }catch(e){setError(e instanceof Error?e.message:"Nem sikerült.");}
 }

 async function add(){
  if(!key||!draft.title.trim()) return;
  const entry:VaultEntry={
   id:crypto.randomUUID(),title:draft.title.trim(),
   category:draft.category as VaultEntry["category"],
   url:draft.url||undefined,username:draft.username||undefined,
   password:draft.password||undefined,pin:draft.pin||undefined,
   updatedAt:new Date().toISOString()
  };
  const next=[entry,...entries];
  const payload=await saveVault(key,next);
  setEntries(next);setSelectedId(entry.id);
  setDraft({title:"",category:"Weboldal",url:"",username:"",password:"",pin:""});
  await syncPayload(payload);
 }

 async function removeSelected(){
  if(!key||!selected) return;
  if(!window.confirm(`Biztosan törlöd ezt a bejegyzést?\n\n${selected.title}`)) return;
  const next=entries.filter(x=>x.id!==selected.id);
  const payload=await saveVault(key,next);
  setEntries(next);setSelectedId(next[0]?.id??null);setReveal(false);
  await syncPayload(payload);
 }

 function lock(){
  setKey(null);setEntries([]);setUnlocked(false);setSelectedId(null);setReveal(false);
 }

 if(!cloudReady) return <div className="page"><Header title="Jelszótár"/><div className="vault-lock card active">
  <div className="vault-emblem">⌘</div><h2>Vault előkészítése</h2>
  <p className="subtle">A titkosított felhőpéldány ellenőrzése…</p>
 </div></div>;

 if(!unlocked) return <div className="page"><Header title="Jelszótár"/><div className="vault-lock card active">
  <div className="vault-emblem">⌘</div>
  <div className="row" style={{justifyContent:"center",marginBottom:8}}>
   <span className={"badge "+(syncState==="synced"?"green":syncState==="offline"?"amber":"")}>
    {syncState==="synced"?"Titkosítva a felhőben":syncState==="offline"?"Helyi példány":"Fokozottan védett"}
   </span>
  </div>
  <h2>{exists?"Vault feloldása":"Titkosított Vault létrehozása"}</h2>
  <p className="subtle">{exists
   ?"A mesterjelszó csak ezen az eszközön fejti vissza a titkosított adatokat."
   :"A mesterjelszót nem tároljuk. A Neonba kizárólag titkosított adat kerül."}</p>
  <input className="input" type="password" value={master} onChange={e=>setMaster(e.target.value)} placeholder="Mesterjelszó"/>
  {error&&<div className="form-error">{error}</div>}
  <button className="primary-btn" style={{width:"100%"}} disabled={master.length<8} onClick={()=>open(!exists)}>{exists?"Feloldás":"Vault létrehozása"}</button>
  <div className="security-note">PBKDF2 250 000 iteráció + AES-GCM 256 bit. A szerver nem kapja meg a mesterjelszót vagy a visszafejtett tartalmat.</div>
 </div></div>;

 return <div className="page"><Header title="Jelszótár"/>
  <div className="row between">
   <div className="row"><Icon tone="green">✓</Icon><div><b>Vault feloldva</b><div className="label">{entries.length} titkosított bejegyzés</div></div></div>
   <button className="ghost-btn" onClick={lock}>Zárolás</button>
  </div>
  <div className="vault-cloud-status">
   <span className={"vault-cloud-dot "+syncState}/>
   <div><b>{syncState==="syncing"?"Titkosított szinkron…":syncState==="synced"?"Felhőszinkron aktív":"Helyi biztonságos mód"}</b>
   <div className="label">{syncState==="offline"?"A változások helyben titkosítva megmaradnak.":"A szerver csak ciphertextet tárol."}</div></div>
  </div>

  <div className="section-title">Új bejegyzés</div><div className="card form-card">
   <input className="input" placeholder="Név, pl. iCloud" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/>
   <select className="input" value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{["Fontos","Bank","Weboldal","Email","Felhő","Kártya PIN","Egyéb"].map(x=><option key={x}>{x}</option>)}</select>
   <input className="input" placeholder="Weboldal / URL" value={draft.url} onChange={e=>setDraft({...draft,url:e.target.value})}/>
   <input className="input" placeholder="Felhasználónév" value={draft.username} onChange={e=>setDraft({...draft,username:e.target.value})}/>
   <input className="input" type="password" placeholder="Jelszó" value={draft.password} onChange={e=>setDraft({...draft,password:e.target.value})}/>
   <input className="input" type="password" inputMode="numeric" placeholder="PIN kód" value={draft.pin} onChange={e=>setDraft({...draft,pin:e.target.value})}/>
   <button className="primary-btn" onClick={add}>Titkosítva mentés</button>
  </div>

  {entries.length>0&&<><div className="section-title">Bejegyzések</div><div className="vault-layout">
   <div className="list">{entries.map(entry=><button className={"list-item "+(selected?.id===entry.id?"selected-row":"")} key={entry.id} onClick={()=>{setSelectedId(entry.id);setReveal(false);}}>
    <Icon>{entry.category[0]}</Icon><div className="grow" style={{textAlign:"left"}}><b>{entry.title}</b><div className="label">{entry.category}</div></div><span className="chev">›</span>
   </button>)}</div>
   {selected&&<div className="card vault-detail">
    <div className="row between"><h2 style={{margin:0}}>{selected.title}</h2><span className="badge green">Titkosítva</span></div>
    {selected.url&&<div className="vault-field"><span className="label">Weboldal</span><span className="value">{selected.url}</span><button className="copy-btn" onClick={()=>navigator.clipboard.writeText(selected.url!)}>Másol</button></div>}
    {selected.username&&<div className="vault-field"><span className="label">Felhasználó</span><span className="value">{reveal?selected.username:"••••••••"}</span><button className="copy-btn" onClick={()=>navigator.clipboard.writeText(selected.username!)}>Másol</button></div>}
    {selected.password&&<div className="vault-field"><span className="label">Jelszó</span><span className="value">{reveal?selected.password:"••••••••••••"}</span><button className="copy-btn" onClick={()=>navigator.clipboard.writeText(selected.password!)}>Másol</button></div>}
    {selected.pin&&<div className="vault-field"><span className="label">PIN</span><span className="value">{reveal?selected.pin:"••••"}</span><button className="copy-btn" onClick={()=>navigator.clipboard.writeText(selected.pin!)}>Másol</button></div>}
    <div className="row" style={{marginTop:14}}>
     <button className="primary-btn grow" onClick={()=>setReveal(v=>!v)}>{reveal?"Elrejtés":"Érzékeny adatok mutatása"}</button>
     <button className="ghost-btn danger" onClick={removeSelected}>Törlés</button>
    </div>
   </div>}
  </div></>}
 </div>
}
function Cards(){ return <Docs cardOnly/>; }
function Vehicles(){
 return <div className="page"><Header title="Járművek"/>
  <div className="card active"><div className="row between"><div><div className="label">Saját jármű</div><h2 style={{margin:"5px 0"}}>Ford</h2><div className="subtle">ABC-123</div></div><div style={{fontSize:54}}>🚙</div></div></div>
  <div className="section-title">Határidők és adatok</div><div className="list">
   <div className="list-item"><Icon tone="green">✓</Icon><div className="grow"><b>Műszaki vizsga</b><div className="success">2027.04.15. · 543 nap</div></div><span className="chev">›</span></div>
   <div className="list-item"><Icon tone="amber">!</Icon><div className="grow"><b>Gépjárműadó</b><div className="amberText">2026.11.12. · 29 nap</div></div><span className="chev">›</span></div>
   <div className="list-item"><Icon tone="green">✓</Icon><div className="grow"><b>Kötelező biztosítás</b><div className="label">2027.02.10.</div></div><span className="chev">›</span></div>
  </div>
 </div>
}
function Tasks(){
 return <div className="page"><Header title="Értesítések és teendők"/>
  <div className="tabs"><button className="tab on">Összes</button><button className="tab">Saját</button><button className="tab">Család</button><button className="tab">Pénzügy</button><button className="tab">NAV</button></div>
  <div className="section-title">Közelgő</div><div className="list">
   {[
    ["Gépjárműadó esedékes","8 nap múlva","amber"],
    ["Családi okmány lejár","14 nap múlva","amber"],
    ["Negyedéves bevallási határidő","29 nap múlva","amber"],
    ["Számla kifizetése","Ma",""],
   ].map(([a,b,t])=><div className="list-item" key={a}><Icon tone={t}>◷</Icon><div className="grow"><b>{a}</b><div className="label">{b}</div></div><span className="chev">›</span></div>)}
  </div>
  <div className="section-title">Értesítési címzettek</div><div className="card"><div className="row between"><span>Saját telefon + email</span><span className="badge green">Aktív</span></div><div className="row between" style={{marginTop:12}}><span>Családi / könyvelői értesítések</span><span className="badge green">Aktív</span></div></div>
 </div>
}
function Reports(){
 return <div className="page printable"><Header title="Riportok"/>
  <div className="notice no-print"><div className="row"><Icon>⇩</Icon><div><b>Nyomtatás és PDF aktív</b><div className="label">A böngésző nyomtatás menüjében PDF-ként is menthető.</div></div></div></div>
  <div className="list" style={{marginTop:12}}>
   {[
    ["Negyedéves bevételi összesítő","PDF · részletes lista és grafikonok"],
    ["Éves pénzügyi kimutatás","PDF · bevétel, kiadás, trendek"],
    ["NAV adószámla kivonat","PDF · adónemenkénti bontás"],
    ["Számlalista exportálása","PDF / Excel · szűrhető, részletes"],
    ["Költségkategória riport","PDF · diagramokkal"],
    ["Családi okmánylista","PDF · lejárati dátumokkal"],
   ].map(([a,b],i)=><button className="list-item no-print" key={a} onClick={()=>window.print()}><Icon>{["▥","◴","N","⇩","◉","▤"][i]}</Icon><div className="grow" style={{textAlign:"left"}}><b>{a}</b><div className="label">{b}</div></div><span className="chev">›</span></button>)}
  </div>
  <div className="print-sheet"><h1>Személyes Központ — Riport</h1><p>Nyomtatási sablon. A valódi NAV-, vállalkozási és családi adatok a következő integrációs körben kerülnek ide.</p><table className="table"><tbody><tr><td>Időszak</td><td>2026 Q3</td></tr><tr><td>Állapot</td><td>Előkészítő</td></tr></tbody></table></div>
 </div>
}
function ScrollTopButton(){
 const [show,setShow]=useState(false);
 useEffect(()=>{
  const onScroll=()=>setShow(window.scrollY>650);
  onScroll();window.addEventListener("scroll",onScroll,{passive:true});
  return()=>window.removeEventListener("scroll",onScroll);
 },[]);
 if(!show)return null;
 return <button className="scroll-top-btn" title="Oldal teteje" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} aria-label="Oldal teteje">↑</button>;
}

function More({go}:{go:(s:Screen)=>void}){
 const items:[Screen,string,string,string][]=[
  ["nav","N","NAV","Adószámla, bevallás, határidők"],
  ["vault","⌘","Jelszótár","Jelszavak és PIN-kódok"],
  ["cards","▣","Kártyák","Bank-, vásárlói és tagsági kártyák"],
  ["vehicles","🚙","Járművek","Adó, biztosítás, műszaki"],
  ["reports","⇩","Riportok","PDF, export, nyomtatás"],
 ];
 return <div className="page"><Header title="További modulok"/><div className="list">{items.map(([s,ic,a,b])=><button className="list-item" key={s} onClick={()=>go(s)}><Icon>{ic}</Icon><div className="grow" style={{textAlign:"left"}}><b>{a}</b><div className="label">{b}</div></div><span className="chev">›</span></button>)}</div></div>
}
export default function Page(){
 const [screen,setScreen]=useState<Screen>("home");
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  if(params.get("open")==="finance"){
    setScreen("finance");
    const bank=params.get("bank");
    if(bank)window.history.replaceState({},document.title,window.location.pathname);
  }
 },[]);
 useEffect(()=>{window.scrollTo({top:0,behavior:"auto"});},[screen]);
 const content=useMemo(()=>{
  switch(screen){
   case "docs":return <Docs/>;case "finance":return <Finance/>;case "tasks":return <Tasks/>;case "more":return <More go={setScreen}/>;
   case "business":return <Business/>;case "nav":return <NavPage/>;case "vault":return <SecureGate scope="vault"><Vault/></SecureGate>;case "cards":return <Cards/>;
   case "vehicles":return <Vehicles/>;case "reports":return <Reports/>;default:return <Home go={setScreen}/>;
  }
 },[screen]);
 return <SecureGate scope="app"><main className="app"><div className="shell">{content}</div><ScrollTopButton/><BottomNav screen={screen} setScreen={setScreen}/></main></SecureGate>
}
