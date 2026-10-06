"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createVault, saveVault, unlockVault, vaultExists, type VaultEntry } from "@/lib/vault";
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
  </tbody></table><button className="primary-btn" style={{width:"100%",marginTop:14}} onClick={()=>window.print()}>Nyomtatás / PDF</button></div>
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
 const [exists,setExists]=useState(false);
 const [unlocked,setUnlocked]=useState(false);
 const [master,setMaster]=useState("");
 const [key,setKey]=useState<CryptoKey|null>(null);
 const [entries,setEntries]=useState<VaultEntry[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [reveal,setReveal]=useState(false);
 const [error,setError]=useState("");
 const [draft,setDraft]=useState({title:"",category:"Weboldal",url:"",username:"",password:"",pin:""});

 useEffect(()=>setExists(vaultExists()),[]);
 const selected=entries.find(x=>x.id===selectedId)??entries[0];

 async function open(create:boolean){
  try{
   setError("");
   const result=create?await createVault(master):await unlockVault(master);
   setKey(result.key);setEntries(result.entries);setUnlocked(true);setExists(true);setMaster("");
  }catch(e){setError(e instanceof Error?e.message:"Nem sikerült.");}
 }
 async function add(){
  if(!key||!draft.title.trim()) return;
  const entry:VaultEntry={id:crypto.randomUUID(),title:draft.title.trim(),category:draft.category as VaultEntry["category"],url:draft.url||undefined,username:draft.username||undefined,password:draft.password||undefined,pin:draft.pin||undefined,updatedAt:new Date().toISOString()};
  const next=[entry,...entries]; await saveVault(key,next);setEntries(next);setSelectedId(entry.id);setDraft({title:"",category:"Weboldal",url:"",username:"",password:"",pin:""});
 }
 function lock(){setKey(null);setEntries([]);setUnlocked(false);setSelectedId(null);setReveal(false);}

 if(!unlocked) return <div className="page"><Header title="Jelszótár"/><div className="vault-lock card active">
  <div className="vault-emblem">⌘</div><h2>{exists?"Vault feloldása":"Titkosított Vault létrehozása"}</h2>
  <p className="subtle">{exists?"Add meg a mesterjelszót.":"A mesterjelszót nem tároljuk és jelenleg nincs visszaállítási lehetőség."}</p>
  <input className="input" type="password" value={master} onChange={e=>setMaster(e.target.value)} placeholder="Mesterjelszó"/>
  {error&&<div className="form-error">{error}</div>}
  <button className="primary-btn" style={{width:"100%"}} onClick={()=>open(!exists)}>{exists?"Feloldás":"Vault létrehozása"}</button>
  <div className="security-note">PBKDF2 250 000 iteráció + AES-GCM 256 bites titkosítás.</div>
 </div></div>;

 return <div className="page"><Header title="Jelszótár"/>
  <div className="row between"><div className="row"><Icon tone="green">✓</Icon><div><b>Vault feloldva</b><div className="label">{entries.length} titkosított bejegyzés</div></div></div><button className="ghost-btn" onClick={lock}>Zárolás</button></div>
  <div className="section-title">Új bejegyzés</div><div className="card form-card">
   <input className="input" placeholder="Név, pl. iCloud" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/>
   <select className="input" value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{["Fontos","Bank","Weboldal","Email","Felhő","Kártya PIN","Egyéb"].map(x=><option key={x}>{x}</option>)}</select>
   <input className="input" placeholder="Weboldal / URL" value={draft.url} onChange={e=>setDraft({...draft,url:e.target.value})}/>
   <input className="input" placeholder="Felhasználónév" value={draft.username} onChange={e=>setDraft({...draft,username:e.target.value})}/>
   <input className="input" type="password" placeholder="Jelszó" value={draft.password} onChange={e=>setDraft({...draft,password:e.target.value})}/>
   <input className="input" type="password" inputMode="numeric" placeholder="PIN kód" value={draft.pin} onChange={e=>setDraft({...draft,pin:e.target.value})}/>
   <button className="primary-btn" onClick={add}>Titkosítva mentés</button>
  </div>
  {entries.length>0&&<><div className="section-title">Bejegyzések</div><div className="vault-layout"><div className="list">{entries.map(entry=><button className={"list-item "+(selected?.id===entry.id?"selected-row":"")} key={entry.id} onClick={()=>{setSelectedId(entry.id);setReveal(false);}}><Icon>{entry.category[0]}</Icon><div className="grow" style={{textAlign:"left"}}><b>{entry.title}</b><div className="label">{entry.category}</div></div><span className="chev">›</span></button>)}</div>
   {selected&&<div className="card vault-detail"><div className="row between"><h2 style={{margin:0}}>{selected.title}</h2><span className="badge green">Titkosítva</span></div>
    {selected.url&&<div className="vault-field"><span className="label">Weboldal</span><span className="value">{selected.url}</span><button className="copy-btn" onClick={()=>navigator.clipboard.writeText(selected.url!)}>Másol</button></div>}
    {selected.username&&<div className="vault-field"><span className="label">Felhasználó</span><span className="value">{reveal?selected.username:"••••••••"}</span><button className="copy-btn" onClick={()=>navigator.clipboard.writeText(selected.username!)}>Másol</button></div>}
    {selected.password&&<div className="vault-field"><span className="label">Jelszó</span><span className="value">{reveal?selected.password:"••••••••••••"}</span><button className="copy-btn" onClick={()=>navigator.clipboard.writeText(selected.password!)}>Másol</button></div>}
    {selected.pin&&<div className="vault-field"><span className="label">PIN</span><span className="value">{reveal?selected.pin:"••••"}</span><button className="copy-btn" onClick={()=>navigator.clipboard.writeText(selected.pin!)}>Másol</button></div>}
    <button className="primary-btn" style={{marginTop:14}} onClick={()=>setReveal(v=>!v)}>{reveal?"Elrejtés":"Érzékeny adatok mutatása"}</button>
   </div>}</div></>}
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
   case "business":return <Business/>;case "nav":return <NavPage/>;case "vault":return <SecureGate scope="vault"><Vault/></SecureGate>;case "cards":return <Cards/>;
   case "vehicles":return <Vehicles/>;case "reports":return <Reports/>;default:return <Home go={setScreen}/>;
  }
 },[screen]);
 return <SecureGate scope="app"><main className="app"><div className="shell">{content}</div><BottomNav screen={screen} setScreen={setScreen}/></main></SecureGate>
}
