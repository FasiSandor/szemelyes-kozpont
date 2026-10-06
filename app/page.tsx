"use client";

import { useMemo, useState } from "react";

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
    ["home","⌂","Főoldal"],["docs","▤","Iratok"],["finance","◴","Pénzügyek"],["tasks","✓","Teendők"],["more","☰","Több"]
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
  return <div className="page">
    <Header/>
    <div className="notice">
      <div className="row between"><div><b>Ma</b><div className="subtle" style={{marginTop:4}}>2 teendőd van</div></div><span className="badge amber">Figyelmet kér</span></div>
      <div style={{marginTop:12}} className="list">
        <div className="row"><Icon tone="amber">◷</Icon><div className="grow">Gépjárműadó esedékes <b>8 nap múlva</b></div></div>
        <div className="row"><Icon tone="amber">▣</Icon><div className="grow">1 okmány hamarosan lejár</div></div>
      </div>
    </div>

    <div className="section-title">Áttekintés</div>
    <div className="grid hero-grid">
      <button className="card active" onClick={()=>go("business")} style={{textAlign:"left",color:"inherit"}}>
        <div className="row between"><Icon>▥</Icon><span className="badge">Vállalkozás</span></div>
        <div className="label" style={{marginTop:12}}>2026 bevétel</div><div className="metric">312 500 Ft</div><div className="delta">↗ +12,4%</div>
      </button>
      <button className="card" onClick={()=>go("nav")} style={{textAlign:"left",color:"inherit"}}>
        <div className="row between"><Icon tone="green">N</Icon><span className="badge green">Rendben</span></div>
        <div className="label" style={{marginTop:12}}>NAV</div><div className="metric" style={{fontSize:18}}>Nincs lejárt tétel</div><div className="delta">Köv.: 2026.11.12.</div>
      </button>
      <MetricCard icon="◴" label="Októberi kiadás" value="286 400 Ft" delta="↗ +5,2%"/>
      <MetricCard icon="♙" label="Család" value="4 profil" delta="1 közelgő lejárat" tone="amber"/>
    </div>

    <div className="content-grid">
      <div>
        <div className="section-title">Havi pénzügyi áttekintés</div>
        <div className="card">
          <div className="row between"><div><b>Bevétel és kiadás</b><div className="subtle" style={{marginTop:3}}>Utolsó 12 hónap</div></div><span className="badge">Év</span></div>
          <MiniChart/>
        </div>
      </div>
      <div>
        <div className="section-title">Gyorsműveletek</div>
        <div className="list">
          <button className="list-item" onClick={()=>go("docs")}><Icon>▤</Icon><div className="grow"><b>Irat fényképezése</b><div className="label">Családtaghoz rendelhető</div></div><span className="chev">›</span></button>
          <button className="list-item" onClick={()=>go("vault")}><Icon>⌘</Icon><div className="grow"><b>Jelszótár</b><div className="label">Titkosított Vault</div></div><span className="chev">›</span></button>
          <button className="list-item" onClick={()=>go("reports")}><Icon>⇩</Icon><div className="grow"><b>Riport készítése</b><div className="label">PDF / nyomtatás</div></div><span className="chev">›</span></button>
        </div>
      </div>
    </div>
  </div>
}
function Docs() {
  const [person,setPerson]=useState("Sándor");
  return <div className="page">
    <Header title="Család és iratok"/>
    <div className="profile-strip">{["Sándor","Feleség","Gyermek 1","Gyermek 2"].map((p,i)=>
      <button key={p} className={"profile "+(person===p?"selected":"")} onClick={()=>setPerson(p)} style={{border:0,background:"transparent",color:"inherit"}}>
        <div className="picon">{i===0?"●":i===1?"◆":"○"}</div><small>{p}</small>
      </button>)}
    </div>
    <div className="row between" style={{marginTop:22}}><div className="section-title" style={{margin:0}}>Okmányok</div><button className="primary-btn">＋ Fényképezés</button></div>
    <div className="grid doc-grid" style={{marginTop:12}}>
      {docs.slice(0,person==="Sándor"?6:4).map(([name,meta,kind])=>
        <div className="card doc-card" key={name}><div className={"doc-preview "+kind}></div><div>
          <div className="doc-name">{name}</div><div className="doc-meta">{meta}</div>
          <div className="row" style={{marginTop:10}}><span className="badge green">Mentve</span><span className="badge">Megnyitás</span></div>
        </div>)}
    </div>
  </div>
}
function Finance() {
  return <div className="page">
    <Header title="Pénzügyek"/>
    <div className="tabs"><button className="tab on">Áttekintés</button><button className="tab">Tranzakciók</button><button className="tab">Kategóriák</button><button className="tab">Számlák</button></div>
    <div className="chips" style={{marginTop:12}}><button className="chip">Hónap</button><button className="chip on">Negyedév</button><button className="chip">Év</button><button className="chip">Egyéni</button></div>
    <div className="section-title">2026 Q3 · július–szeptember</div>
    <div className="grid hero-grid"><MetricCard icon="↗" label="Bevétel" value="1 248 500 Ft" delta="↗ 12,4%"/><MetricCard icon="↘" label="Kiadás" value="862 300 Ft" delta="− 5,1%" tone="red"/></div>
    <div className="card" style={{marginTop:12}}><div className="row between"><b>Havi mozgás</b><span className="badge">Vegyes</span></div><MiniChart/></div>
    <div className="section-title">Kiadások kategóriák szerint</div>
    <div className="card"><div className="donut"></div><div className="list">
      {["Lakhatás · 28%","Élelmiszer · 18%","Üzemanyag · 14%","Szolgáltatások · 12%","Vállalkozás · 11%","Egyéb · 17%"].map((x,i)=><div className="row between" key={x}><span className="subtle">{x}</span><span style={{color:["#60A5FA","#22D3EE","#22C55E","#F59E0B","#8b5cf6","#64748B"][i]}}>●</span></div>)}
    </div></div>
  </div>
}
function Business() {
 return <div className="page"><Header title="Vállalkozás"/>
  <div className="tabs"><button className="tab on">Számlák</button><button className="tab">Bevétel</button><button className="tab">Kiadás</button><button className="tab">Partnerek</button></div>
  <div className="section-title">2026 Q3 · július–szeptember</div>
  <div className="grid hero-grid">
    <MetricCard icon="#" label="Számlák száma" value="8 db" delta="Negyedév"/>
    <MetricCard icon="Ft" label="Összesített érték" value="292 500 Ft" delta="Kiszámlázva"/>
    <MetricCard icon="≈" label="Átlagos számla" value="36 563 Ft" delta="8 tételből"/>
    <MetricCard icon="↑" label="Legnagyobb számla" value="84 000 Ft" delta="Kifizetve"/>
  </div>
  <div className="section-title">Számlák</div><div className="card"><table className="table"><tbody>
   {[["2026.09.14.","Partner A","84 000 Ft"],["2026.09.03.","Partner B","42 000 Ft"],["2026.08.21.","Partner C","38 000 Ft"],["2026.08.12.","Partner D","26 500 Ft"]].map(r=><tr key={r[0]+r[1]}><td><b>{r[1]}</b><div className="label">{r[0]}</div></td><td>{r[2]}<div className="success" style={{fontSize:11}}>● Kifizetve</div></td></tr>)}
  </tbody></table><button className="primary-btn" style={{width:"100%",marginTop:14}}>Negyedéves összesítő PDF</button></div>
 </div>
}
function NavPage(){
 return <div className="page"><Header title="NAV"/>
  <div className="notice" style={{borderColor:"rgba(34,197,94,.3)",background:"rgba(34,197,94,.07)"}}><div className="row"><Icon tone="green">✓</Icon><div><b>Nincs lejárt tartozásod</b><div className="label">Következő határidő: 2026.11.12.</div></div></div></div>
  <div className="section-title">Adószámla egyenleg</div><div className="card"><table className="table"><tbody>
    {["Összesen","ÁFA","SZJA","TB / Járulék","Gépjárműadó","Egyéb"].map(x=><tr key={x}><td>{x}</td><td>0 Ft ›</td></tr>)}
  </tbody></table></div>
  <div className="section-title">Következő esedékes tételek</div><div className="list">
    <div className="list-item"><Icon tone="amber">▣</Icon><div className="grow"><b>Gépjárműadó</b><div className="label">2026.11.12.</div></div><b className="amberText">28 000 Ft</b></div>
    <div className="list-item"><Icon>▥</Icon><div className="grow"><b>Negyedéves bevallás</b><div className="label">2026 Q3 · részletes adatok</div></div><span className="chev">›</span></div>
    <div className="list-item"><Icon>◷</Icon><div className="grow"><b>SZJA előleg</b><div className="label">2027.01.12.</div></div><span className="chev">›</span></div>
  </div>
 </div>
}
function Vault(){
 const [reveal,setReveal]=useState(false);
 return <div className="page"><Header title="Jelszótár"/>
  <div className="notice"><div className="row"><Icon>⌘</Icon><div className="grow"><b>Titkosított Vault</b><div className="label">A valódi verzióban kliensoldali titkosítással</div></div><span className="badge green">Zárolt</span></div></div>
  <div className="section-title">Kategóriák</div><div className="list">
   {["Fontos · 6","Bankok · 4","Weboldalak · 8","Email · 3","Felhőszolgáltatások · 2","Kártya PIN-ek · 4"].map(x=><div className="list-item" key={x}><Icon>{x[0]}</Icon><div className="grow"><b>{x}</b></div><span className="chev">›</span></div>)}
  </div>
  <div className="section-title">Kiemelt bejegyzés</div><div className="card">
   <div className="row between"><div><div className="label">Felhőszolgáltatás</div><h2 style={{margin:"4px 0"}}>iCloud</h2></div><Icon>★</Icon></div>
   <div className="vault-field"><span className="label">Weboldal</span><span className="value">appleid.apple.com</span><span>⧉</span></div>
   <div className="vault-field"><span className="label">Felhasználónév</span><span className="value">••••••••••</span><span>⧉</span></div>
   <div className="vault-field"><span className="label">Jelszó</span><span className="value">{reveal?"demo-jelszo-nem-valodi":"••••••••••••"}</span><button className="ghost-btn" onClick={()=>setReveal(v=>!v)}>{reveal?"Elrejt":"Mutat"}</button></div>
  </div>
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
 return <div className="page"><Header title="Riportok"/>
  <div className="list">
   {[
    ["Negyedéves bevételi összesítő","PDF · részletes lista és grafikonok"],
    ["Éves pénzügyi kimutatás","PDF · bevétel, kiadás, trendek"],
    ["NAV adószámla kivonat","PDF · adónemenkénti bontás"],
    ["Számlalista exportálása","PDF / Excel · szűrhető, részletes"],
    ["Költségkategória riport","PDF · diagramokkal"],
    ["Családi okmánylista","PDF · lejárati dátumokkal"],
   ].map(([a,b],i)=><div className="list-item" key={a}><Icon>{["▥","◴","N","⇩","◉","▤"][i]}</Icon><div className="grow"><b>{a}</b><div className="label">{b}</div></div><span className="chev">›</span></div>)}
  </div>
 </div>
}
function More({go}:{go:(s:Screen)=>void}){
 const items:[Screen,string,string,string][]=[
  ["business","▥","Vállalkozás","Számlák, bevétel, partnerek"],
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
 const content=useMemo(()=>{
  switch(screen){
   case "docs":return <Docs/>;case "finance":return <Finance/>;case "tasks":return <Tasks/>;case "more":return <More go={setScreen}/>;
   case "business":return <Business/>;case "nav":return <NavPage/>;case "vault":return <Vault/>;case "cards":return <Cards/>;
   case "vehicles":return <Vehicles/>;case "reports":return <Reports/>;default:return <Home go={setScreen}/>;
  }
 },[screen]);
 return <main className="app"><div className="shell">{content}</div><BottomNav screen={screen} setScreen={setScreen}/></main>
}
