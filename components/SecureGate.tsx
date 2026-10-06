"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useEffect, useState } from "react";

type Scope="app"|"vault";

type Status={
  authenticated:boolean;
  hasPin:boolean;
  hasBiometric:boolean;
  appUnlocked:boolean;
  vaultUnlocked:boolean;
};

export default function SecureGate({
  scope,
  children,
}:{scope:Scope;children:React.ReactNode}){
  const [status,setStatus]=useState<Status|null>(null);
  const [showPin,setShowPin]=useState(false);
  const [pin,setPin]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  async function refresh(){
    const res=await fetch("/api/unlock/status",{cache:"no-store"});
    if(res.status===401){
      window.location.href="/auth/sign-in";
      return;
    }
    const data=await res.json();
    setStatus(data);
  }

  useEffect(()=>{ void refresh(); },[]);

  const unlocked=scope==="vault"?status?.vaultUnlocked:status?.appUnlocked;
  const ready=Boolean(status?.hasPin&&status?.hasBiometric);

  async function verifyPin(action:"set"|"verify"){
    setBusy(true);setMessage("");
    try{
      const res=await fetch("/api/unlock/pin",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action,pin,scope})
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"A kód nem megfelelő.");
      setPin("");
      setShowPin(false);
      await refresh();
    }catch(e){
      setMessage(e instanceof Error?e.message:"Nem sikerült a feloldás.");
    }finally{setBusy(false);}
  }

  async function biometric(mode:"register"|"authenticate"){
    setBusy(true);setMessage("");
    try{
      const optionsRes=await fetch("/api/unlock/webauthn?mode="+(mode==="register"?"register":"authenticate"),{cache:"no-store"});
      const options=await optionsRes.json();
      if(!optionsRes.ok) throw new Error(options.error||"A Face ID nem indítható.");

      const response=mode==="register"
        ?await startRegistration({optionsJSON:options})
        :await startAuthentication({optionsJSON:options});

      const verifyRes=await fetch("/api/unlock/webauthn",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action:mode,response,scope})
      });
      const data=await verifyRes.json();
      if(!verifyRes.ok||!data.verified) throw new Error(data.error||"A Face ID ellenőrzés nem sikerült.");
      await refresh();
    }catch(e){
      setMessage(e instanceof Error?e.message:"A Face ID nem sikerült.");
      setShowPin(true);
    }finally{setBusy(false);}
  }

  useEffect(()=>{
    if(!status||unlocked||busy) return;
    if(status.hasBiometric){
      void biometric("authenticate");
    }
  },[status,unlocked]);

  if(!status){
    return <main className="lock-screen"><div className="lock-orb"><span/></div><div className="lock-copy"><div className="eyebrow">SZEMÉLYES KÖZPONT</div><h1>Biztonságos megnyitás</h1><p>Azonosítás előkészítése…</p></div></main>;
  }

  if(unlocked&&ready) return <>{children}</>;

  const firstSetup=!status.hasPin&&!status.hasBiometric;

  return <main className="lock-screen">
    <div className="lock-aurora lock-aurora-a"/>
    <div className="lock-aurora lock-aurora-b"/>
    <div className={"lock-orb "+(busy?"scanning":"")}>
      <div className="faceid-glyph">
        <span className="corner tl"/><span className="corner tr"/><span className="corner bl"/><span className="corner br"/>
        <span className="eye e1"/><span className="eye e2"/><span className="mouth"/>
      </div>
      <span className="scan-line"/>
    </div>

    <div className="lock-copy">
      <div className="eyebrow">{scope==="vault"?"FOKOZOTTAN VÉDETT":"SZEMÉLYES KÖZPONT"}</div>
      <h1>{scope==="vault"?"Jelszótár feloldása":firstSetup?"Biztonság beállítása":"Face ID szükséges"}</h1>
      <p>{scope==="vault"?"A jelszavaid és PIN-kódjaid külön azonosítást kérnek.":firstSetup?"Állíts be Face ID-t és egy 6 jegyű tartalék kódot.":"Nézz a telefonra a feloldáshoz."}</p>
    </div>

    {message&&<div className="lock-message">{message}</div>}

    <div className="lock-actions">
      {!status.hasBiometric&&<button className="primary-btn lock-main-btn" onClick={()=>biometric("register")} disabled={busy}>
        {busy?"Face ID beállítása…":"Face ID beállítása"}
      </button>}

      {status.hasBiometric&&<button className="primary-btn lock-main-btn" onClick={()=>biometric("authenticate")} disabled={busy}>
        {busy?"Azonosítás…":"Face ID használata"}
      </button>}

      {!showPin&&status.hasPin&&<button className="auth-switch" onClick={()=>setShowPin(true)}>Kód megadása</button>}

      {(showPin||!status.hasPin)&&<div className="pin-panel">
        <div className="pin-dots">{Array.from({length:6},(_,i)=><span key={i} className={i<pin.length?"filled":""}/>)}</div>
        <input className="pin-input" aria-label="6 jegyű kód" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))} autoFocus/>
        <div className="pin-keypad">
          {[1,2,3,4,5,6,7,8,9].map(n=><button key={n} onClick={()=>setPin(v=>(v+String(n)).slice(0,6))}>{n}</button>)}
          <button onClick={()=>setPin("")}>C</button><button onClick={()=>setPin(v=>(v+"0").slice(0,6))}>0</button><button onClick={()=>setPin(v=>v.slice(0,-1))}>⌫</button>
        </div>
        <button className="primary-btn lock-main-btn" disabled={pin.length!==6||busy} onClick={()=>verifyPin(status.hasPin?"verify":"set")}>
          {status.hasPin?"Feloldás kóddal":"Tartalék kód mentése"}
        </button>
      </div>}
    </div>
  </main>;
}
