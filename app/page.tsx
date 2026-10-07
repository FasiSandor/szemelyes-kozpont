"use client";
// deploy-kick: nav-date-buckets-v1
// deploy-kick: revenue-nav-deadlines-v2

import { useEffect, useMemo, useRef, useState } from "react";
import { createVault, getLocalVaultPayload, saveVault, setLocalVaultPayload, unlockVault, vaultExists, type StoredVault, type VaultEntry } from "@/lib/vault";
import SecureGate from "@/components/SecureGate";

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
function PrivacyToggle(){
  const [revealed,setRevealed]=useState(false);
  const timerRef=useRef<number|null>(null);

  function hide(){
    document.documentElement.removeAttribute("data-money-visible");
    setRevealed(false);
    if(timerRef.current!==null){window.clearTimeout(timerRef.current);timerRef.current=null;}
  }
  function toggle(){
    if(revealed){hide();return;}
    document.documentElement.setAttribute("data-money-visible","true");
    setRevealed(true);
    if(timerRef.current!==null)window.clearTimeout(timerRef.current);
    timerRef.current=window.setTimeout(()=>hide(),60000);
  }

  useEffect(()=>{
    hide();
    const onVisibility=()=>{if(document.hidden)hide();};
    const onBlur=()=>hide();
    document.addEventListener("visibilitychange",onVisibility);
    window.addEventListener("blur",onBlur);
    return()=>{
      document.removeEventListener("visibilitychange",onVisibility);
      window.removeEventListener("blur",onBlur);
      if(timerRef.current!==null)window.clearTimeout(timerRef.current);
    };
  },[]);

  return <button className={"privacy-toggle "+(revealed?"on":"")} onClick={toggle} aria-label={revealed?"Pénzügyi adatok elrejtése":"Pénzügyi adatok megjelenítése"} title={revealed?"Elrejtés":"Pénzügyi adatok megjelenítése"}>{revealed?"◉":"◌"}</button>;
}
function Header({title="Személyes Központ",back,onBack}:{title?:string;back?:boolean;onBack?:()=>void}) {
  return <div className="topbar">
    <div className="row">
      {back && <button className="ghost-btn" onClick={onBack} aria-label="Vissza">‹</button>}
      <div><div className="eyebrow">2026. október 6.</div><div className="title">{title}</div></div>
    </div>
    <div className="row header-actions"><PrivacyToggle/><div className="avatar">SK</div></div>
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
  useEffect(()=>{
    let active=true;
    const month=new Date().toISOString().slice(0,7);
    Promise.all([
      fetch("/api/nav/invoices?year="+new Date().getFullYear(),{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/finance/transactions?month="+month,{cache:"no-store"}).then(r=>r.json())
    ]).then(([nav,finance])=>{
      if(!active)return;
      setNavData(nav);
      setFinanceData(finance);
    }).catch(()=>{});
    return()=>{active=false;};
  },[]);
  const navReady=Boolean(navData?.configured);
  const navSummary=navData?.summary;
  const allYears=(navData?.allYears||[]).slice().sort((a,b)=>a.year-b.year);
  const totalInvoices=allYears.reduce((n,x)=>n+Number(x.count||0),0);
  const totalRevenue=allYears.reduce((n,x)=>n+Number(x.gross_huf||0),0);
  const homeColors=["#3B82F6","#22D3EE","#22C55E","#F59E0B","#8B5CF6","#EF4444","#60A5FA","#64748B"];
  const makeDonut=(items:FinanceSlice[])=>{
    const total=items.reduce((sum,x)=>sum+Number(x.amount_huf||0),0);
    let cursor=0;
    const stops=items.slice(0,8).map((x,i)=>{
      const pct=total?Number(x.amount_huf||0)/total*100:0;
      const from=cursor;cursor+=pct;
      return homeColors[i%homeColors.length]+" "+from+"% "+cursor+"%";
    }).join(", ");
    return {total,background:"conic-gradient("+(stops||"#2A3445 0 100%")+")"};
  };
  const purposeDonut=makeDonut(financeData?.categories||[]);
  const merchantDonut=makeDonut(financeData?.merchants||[]);

  return <div className="page home-v2">
    <Header/>
    <button className="notice home-upcoming" onClick={()=>go("tasks")}>
      <div className="row between"><div><b>Közelgő</b><div className="subtle" style={{marginTop:4}}>Teendők, lejáratok és határidők</div></div><span className="badge amber">Megnyitás ›</span></div>
      <div className="home-upcoming-list">
        <div className="row"><Icon tone="amber">◷</Icon><div className="grow"><b>Teendők</b><div className="label">A teljes listát itt éred el</div></div></div>
        <div className="row"><Icon tone="amber">▣</Icon><div className="grow"><b>Lejáratok és NAV-határidők</b><div className="label">Egy helyen, időrendben</div></div></div>
      </div>
    </button>

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
        <div className="metric">4 profil</div>
        <div className="delta">Okmányok és lejáratok</div>
      </button>
      <button className="card home-overview-card" onClick={()=>go("finance")}>
        <div className="row between"><Icon>◴</Icon><span className="badge">Pénzügyek</span></div>
        <div className="label">Havi pénzügyi kép</div>
        <div className="metric">Megoszlások</div>
        <div className="delta">Mire költök? · Hol költök?</div>
      </button>
    </div>

    <div className="section-title">Havi pénzügyi kép</div>
    <div className="card home-finance-summary">
      <div className="row between"><div><b>Kiadások megoszlása</b><div className="label">Két nézet: mire és hol költöd</div></div><button className="ghost-btn" onClick={()=>go("finance")}>Részletek ›</button></div>
      <div className="home-donut-preview-grid">
        <div className="home-donut-preview">
          <div className="home-real-donut" style={{background:purposeDonut.background}}><span>{purposeDonut.total?money(purposeDonut.total):"—"}</span></div>
          <div><b>Mire költök?</b><div className="label">{purposeDonut.total?(financeData?.categories||[]).slice(0,3).map(x=>x.name).join(" · "):"Még nincs kiadási adat"}</div></div>
        </div>
        <div className="home-donut-preview">
          <div className="home-real-donut" style={{background:merchantDonut.background}}><span>{merchantDonut.total?money(merchantDonut.total):"—"}</span></div>
          <div><b>Hol költök?</b><div className="label">{merchantDonut.total?(financeData?.merchants||[]).slice(0,3).map(x=>x.name).join(" · "):"Még nincs kereskedői adat"}</div></div>
        </div>
      </div>
      <div className="finance-source-note">{purposeDonut.total||merchantDonut.total?"Az aktuális havi OTP/banki tranzakciókból számolva.":"A donutok automatikusan megtelnek, amint a banki tranzakciók beérkeznek."}</div>
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
function Docs() {
  type RemoteMember={id:string;display_name:string;relation:string|null;linked_user_id:string|null};
  type DocPhoto={id:string;imageUrl:string;storageKey:string};
  type RemoteDocument={
    id:string;family_member_id:string;kind:string;title:string;issue_date:string|null;
    expiry_date:string|null;note:string|null;created_at:string;member_name:string;
    front:DocPhoto|null;back:DocPhoto|null;
  };

  const kindOptions=[
    ["identity","Személyazonosító igazolvány"],["address","Lakcímkártya"],["tax","Adókártya"],
    ["health","TAJ kártya"],["student","Diákigazolvány"],["teacher","Pedagógusigazolvány"],
    ["vehicle","Jármű okmány"],["insurance","Biztosítás"],["contract","Szerződés"],
    ["shopping_card","Kártya / tagság"],["other","Egyéb irat"]
  ] as const;

  const [family,setFamily]=useState<RemoteMember[]>([]);
  const [personId,setPersonId]=useState("");
  const [documents,setDocuments]=useState<RemoteDocument[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [showForm,setShowForm]=useState(false);
  const [saving,setSaving]=useState(false);
  const [kind,setKind]=useState("identity");
  const [title,setTitle]=useState("Személyazonosító igazolvány");
  const [issueDate,setIssueDate]=useState("");
  const [expiryDate,setExpiryDate]=useState("");
  const [note,setNote]=useState("");
  const [frontFile,setFrontFile]=useState<File|null>(null);
  const [backFile,setBackFile]=useState<File|null>(null);
  const frontRef=useRef<HTMLInputElement>(null);
  const backRef=useRef<HTMLInputElement>(null);

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
      catch(e){if(active) setMessage(e instanceof Error?e.message:"Betöltési hiba.");}
      finally{if(active) setLoading(false);}
    })();
    return()=>{active=false;};
  },[]);

  function resetForm(){
    setKind("identity");setTitle("Személyazonosító igazolvány");
    setIssueDate("");setExpiryDate("");setNote("");
    setFrontFile(null);setBackFile(null);setShowForm(false);
  }

  function changeKind(next:string){
    setKind(next);
    const label=kindOptions.find(([value])=>value===next)?.[1]||"Egyéb irat";
    setTitle(label);
  }

  async function uploadSide(file:File,side:"front"|"back",groupId?:string){
    const prepare=await fetch("/api/documents",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({
        action:"prepare",familyMemberId:personId,title,kind,
        contentType:file.type||"image/jpeg",documentGroupId:groupId,side
      })
    });
    const prep=await prepare.json();
    if(!prepare.ok) throw new Error(prep.error||"A feltöltés előkészítése nem sikerült.");

    const upload=await fetch(prep.uploadUrl,{
      method:"PUT",headers:{"content-type":file.type||"image/jpeg"},body:file
    });
    if(!upload.ok) throw new Error("A fotó feltöltése nem sikerült.");

    const finalize=await fetch("/api/documents",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({
        action:"finalize",familyMemberId:personId,title,kind,
        storageKey:prep.storageKey,documentGroupId:prep.documentGroupId,side,
        issueDate:issueDate||null,expiryDate:expiryDate||null,note:note||null
      })
    });
    const saved=await finalize.json();
    if(!finalize.ok) throw new Error(saved.error||"Az irat mentése nem sikerült.");
    return prep.documentGroupId as string;
  }

  async function saveDocument(){
    if(!personId||!frontFile||!title.trim()) return;
    setSaving(true);setMessage("");
    try{
      const groupId=await uploadSide(frontFile,"front");
      if(backFile) await uploadSide(backFile,"back",groupId);
      await loadDocuments();
      setMessage("Az irat biztonságosan elmentve.");
      resetForm();
    }catch(e){
      setMessage(e instanceof Error?e.message:"Nem sikerült menteni az iratot.");
    }finally{setSaving(false);}
  }

  async function deleteDocument(doc:RemoteDocument){
    if(!window.confirm(`Biztosan törlöd ezt az iratot?\n\n${doc.title}`)) return;
    setMessage("Törlés…");
    const res=await fetch("/api/documents?groupId="+encodeURIComponent(doc.id),{method:"DELETE"});
    const data=await res.json();
    if(!res.ok){setMessage(data.error||"Nem sikerült törölni.");return;}
    await loadDocuments();
    setMessage("Az irat törölve.");
  }

  async function addFamilyMember(){
    const displayName=window.prompt("Családtag neve")?.trim();
    if(!displayName) return;
    const relation=window.prompt("Kapcsolat (pl. gyermek, házastárs)")?.trim()||"Családtag";
    const res=await fetch("/api/household",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({displayName,relation})
    });
    const data=await res.json();
    if(!res.ok){setMessage(data.error||"Nem sikerült hozzáadni.");return;}
    await loadHousehold();
    if(data.member?.id) setPersonId(data.member.id);
  }

  function expiryBadge(doc:RemoteDocument){
    if(!doc.expiry_date) return <span className="badge green">Nincs lejárat</span>;
    const days=Math.ceil((new Date(doc.expiry_date).getTime()-Date.now())/86400000);
    if(days<0) return <span className="badge" style={{color:"#fca5a5",borderColor:"rgba(239,68,68,.35)"}}>Lejárt</span>;
    if(days<=30) return <span className="badge amber">{days} nap</span>;
    return <span className="badge green">Érvényes</span>;
  }

  const selected=family.find(x=>x.id===personId)??family[0];
  const visible=documents.filter(doc=>!personId||doc.family_member_id===personId);

  return <div className="page">
    <Header title="Család és iratok"/>

    <div className="profile-strip">
      {family.map((p,i)=><button key={p.id} className={"profile "+(personId===p.id?"selected":"")} onClick={()=>setPersonId(p.id)} style={{border:0,background:"transparent",color:"inherit"}}>
        <div className="picon">{i===0?"●":i===1?"◆":"○"}</div><small>{p.display_name}</small>
      </button>)}
      <button className="profile" onClick={addFamilyMember} style={{border:0,background:"transparent",color:"inherit"}}>
        <div className="picon">＋</div><small>Hozzáadás</small>
      </button>
    </div>

    <div className="row between" style={{marginTop:22}}>
      <div>
        <div className="section-title" style={{margin:0}}>Okmányok</div>
        <div className="label">{selected?selected.display_name+" · "+(selected.relation||"Családtag"):"Családi tér"}</div>
      </div>
      <button className="primary-btn" disabled={!personId} onClick={()=>setShowForm(true)}>＋ Új irat</button>
    </div>

    <div className="notice" style={{marginTop:12}}>
      <div className="row"><Icon tone="green">✓</Icon><div>
        <b>Privát, többeszközös irattár</b>
        <div className="label">Előlap, hátlap, lejárat és családtag egy helyen. A fotók privát tárhelyen maradnak.</div>
      </div></div>
    </div>

    {message&&<div className="auth-message" style={{marginTop:12}}>{message}</div>}

    {showForm&&<div className="card doc-editor" style={{marginTop:12}}>
      <div className="row between"><div><b>Új irat</b><div className="label">{selected?.display_name}</div></div><button className="ghost-btn" onClick={resetForm}>Bezárás</button></div>
      <div className="form-card" style={{marginTop:14}}>
        <label className="label">Irat típusa</label>
        <select className="input" value={kind} onChange={e=>changeKind(e.target.value)}>
          {kindOptions.map(([value,label])=><option value={value} key={value}>{label}</option>)}
        </select>
        <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Irat neve"/>
        <div className="doc-date-grid">
          <label><span className="label">Kiállítás</span><input className="input" type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)}/></label>
          <label><span className="label">Lejárat</span><input className="input" type="date" value={expiryDate} onChange={e=>setExpiryDate(e.target.value)}/></label>
        </div>
        <textarea className="input" rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Megjegyzés (opcionális)"/>
        <div className="doc-upload-grid">
          <button className={"doc-upload "+(frontFile?"ready":"")} onClick={()=>frontRef.current?.click()}>
            <span className="doc-upload-icon">{frontFile?"✓":"＋"}</span><b>Előlap</b><small>{frontFile?frontFile.name:"Fotó készítése / kiválasztása"}</small>
          </button>
          <button className={"doc-upload "+(backFile?"ready":"")} onClick={()=>backRef.current?.click()}>
            <span className="doc-upload-icon">{backFile?"✓":"＋"}</span><b>Hátlap</b><small>{backFile?backFile.name:"Opcionális"}</small>
          </button>
        </div>
        <input ref={frontRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={e=>setFrontFile(e.target.files?.[0]||null)}/>
        <input ref={backRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={e=>setBackFile(e.target.files?.[0]||null)}/>
        <button className="primary-btn" disabled={!frontFile||saving} onClick={saveDocument}>{saving?"Mentés…":"Irat mentése"}</button>
      </div>
    </div>}

    {loading?<div className="empty-card"><div className="empty-icon">◷</div><b>Betöltés…</b></div>:
    visible.length===0?<div className="empty-card">
      <div className="empty-icon">▤</div><b>Még nincs feltöltött irat</b>
      <div className="label">Az „Új irat” gombbal előlapot és hátlapot is menthetsz.</div>
    </div>:
    <div className="grid doc-grid" style={{marginTop:12}}>
      {visible.map(doc=><div className="card compact-doc" key={doc.id}>
        <div className="doc-photo-stack">
          {doc.front?<button className="photo-wrap" onClick={()=>window.open(doc.front!.imageUrl,"_blank")}><img src={doc.front.imageUrl} alt={doc.title+" előlap"}/><span>Előlap</span></button>:<div className="photo-wrap missing">Nincs előlap</div>}
          {doc.back&&<button className="photo-wrap back" onClick={()=>window.open(doc.back!.imageUrl,"_blank")}><img src={doc.back.imageUrl} alt={doc.title+" hátlap"}/><span>Hátlap</span></button>}
        </div>
        <div className="row between" style={{marginTop:11,alignItems:"flex-start"}}>
          <div className="grow"><div className="doc-name">{doc.title}</div><div className="doc-meta">{doc.member_name}</div></div>
          {expiryBadge(doc)}
        </div>
        <div className="doc-meta-row">
          <span>{doc.expiry_date?"Lejár: "+new Date(doc.expiry_date).toLocaleDateString("hu-HU"):"Határozatlan / nincs megadva"}</span>
          <span>{doc.back?"2 oldal":"1 oldal"}</span>
        </div>
        {doc.note&&<div className="doc-note">{doc.note}</div>}
        <button className="doc-delete" onClick={()=>deleteDocument(doc)}>Irat törlése</button>
      </div>)}
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

    <div className="finance-top-row">
      <label className="finance-month-picker"><span>Időszak</span><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>
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
function Cards(){
 return <div className="page"><Header title="Kártyák"/>
   <div className="tabs"><button className="tab on">Bankkártyák</button><button className="tab">Bevásárlókártyák</button><button className="tab">Tagságok</button></div>
   <div className="card active" style={{marginTop:18,padding:20,background:"linear-gradient(135deg,#0a2750,#0d4fa1 55%,#0b1627)"}}>
    <div className="row between"><b style={{fontSize:18}}>Bankkártya</b><span className="badge">Debet</span></div>
    <div style={{fontSize:22,letterSpacing:3,margin:"38px 0 18px"}}>•••• •••• •••• 1234</div>
    <div className="row between"><span>LEJÁR 06/28</span><b>◉◉</b></div>
   </div>
   <div className="card" style={{marginTop:12}}><div className="vault-field"><span className="label">PIN kód</span><span className="value">••••</span><button className="ghost-btn">Mutat</button></div><div className="vault-field"><span className="label">Számla</span><span className="value">Főszámla</span><span>›</span></div></div>
 </div>
}
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
