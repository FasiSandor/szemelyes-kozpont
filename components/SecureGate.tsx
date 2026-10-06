"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useEffect, useMemo, useState } from "react";

type Scope="app"|"vault";
type Status={
  authenticated:boolean;
  hasPin:boolean;
  hasBiometric:boolean;
  appUnlocked:boolean;
  vaultUnlocked:boolean;
};

type PinStage="enter"|"confirm";

export default function SecureGate({scope,children}:{scope:Scope;children:React.ReactNode}){
  const [status,setStatus]=useState<Status|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [showPin,setShowPin]=useState(false);
  const [pin,setPin]=useState("");
  const [firstPin,setFirstPin]=useState("");
  const [pinStage,setPinStage]=useState<PinStage>("enter");
  const [autoTried,setAutoTried]=useState(false);
  const [platformReady,setPlatformReady]=useState<boolean|null>(null);

  const unlocked=scope==="vault"?status?.vaultUnlocked:status?.appUnlocked;
  const setupComplete=Boolean(status?.hasPin&&status?.hasBiometric);
  const setupMode=scope==="app"&&!setupComplete;

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

  useEffect(()=>{
    let mounted=true;
    (async()=>{
      try{
        if(!window.PublicKeyCredential){
          if(mounted) setPlatformReady(false);
          return;
        }
        const available=await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if(mounted) setPlatformReady(available);
      }catch{
        if(mounted) setPlatformReady(false);
      }
    })();
    return()=>{mounted=false;};
  },[]);

  async function verifyPin(action:"set"|"verify"){
    setBusy(true);
    setMessage("");
    try{
      const res=await fetch("/api/unlock/pin",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action,pin,scope})
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"A kód nem megfelelő.");
      setPin("");
      setFirstPin("");
      setPinStage("enter");
      setShowPin(false);
      await refresh();
    }catch(e){
      setMessage(e instanceof Error?e.message:"Nem sikerült a feloldás.");
    }finally{
      setBusy(false);
    }
  }

  function nextSetupPin(){
    if(pin.length!==6) return;
    if(pinStage==="enter"){
      setFirstPin(pin);
      setPin("");
      setPinStage("confirm");
      setMessage("");
      return;
    }
    if(pin!==firstPin){
      setMessage("A két kód nem egyezik. Add meg újra.");
      setPin("");
      setFirstPin("");
      setPinStage("enter");
      return;
    }
    void verifyPin("set");
  }

  async function biometric(mode:"register"|"authenticate"){
    setBusy(true);
    setMessage("");
    try{
      if(platformReady===false){
        throw new Error("A Face ID / Passkey ebben a böngészőben nem érhető el. Nyisd meg ezt az oldalt Safariban, majd próbáld újra.");
      }

      const optionsRes=await fetch("/api/unlock/webauthn?mode="+mode,{cache:"no-store"});
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
      if(!verifyRes.ok||!data.verified){
        throw new Error(data.error||"A Face ID ellenőrzés nem sikerült.");
      }
      setAutoTried(true);
      await refresh();
    }catch(e){
      const text=e instanceof Error?e.message:"A Face ID nem sikerült.";
      setMessage(text);
      if(!setupMode) setShowPin(true);
    }finally{
      setBusy(false);
    }
  }

  useEffect(()=>{
    if(!status||setupMode||unlocked||busy||autoTried||!status.hasBiometric) return;
    setAutoTried(true);
    void biometric("authenticate");
  },[status,setupMode,unlocked,busy,autoTried]);

  const step=useMemo(()=>{
    if(!status) return 0;
    if(setupMode&&!status.hasBiometric) return 1;
    if(setupMode&&!status.hasPin) return 2;
    return 3;
  },[status,setupMode]);

  if(!status){
    return <main className="security-v2"><div className="security-v2-loader"/><p>Biztonságos megnyitás…</p></main>;
  }

  if(unlocked&&setupComplete) return <>{children}</>;

  const isVault=scope==="vault";
  const pinSetup=setupMode&&status.hasBiometric&&!status.hasPin;
  const pinTitle=pinStage==="confirm"?"Erősítsd meg a kódot":"Adj meg egy 6 jegyű kódot";

  return <main className={"security-v2 "+(isVault?"vault-mode":"")}>
    <div className="security-v2-grid"/>
    <div className="security-v2-glow g1"/>
    <div className="security-v2-glow g2"/>

    <section className="security-v2-shell">
      <div className="security-v2-top">
        <div className="security-v2-badge">{isVault?"FOKOZOTTAN VÉDETT":"SZEMÉLYES KÖZPONT"}</div>
        {setupMode&&<div className="security-v2-steps">
          {[1,2,3].map(n=><span key={n} className={n<=step?"on":""}/>)}
        </div>}
      </div>

      <div className={"security-v2-visual "+(busy?"scanning":"")}>
        <div className="security-v2-icon">
          {isVault?<span className="vault-mark">⌁</span>:<div className="faceid-mini">
            <i className="c tl"/><i className="c tr"/><i className="c bl"/><i className="c br"/>
            <i className="eye l"/><i className="eye r"/><i className="smile"/>
          </div>}
        </div>
        <span className="security-v2-scan"/>
      </div>

      <div className="security-v2-copy">
        <h1>{isVault
          ?"Jelszótár feloldása"
          :setupMode
            ?step===1?"Face ID bekapcsolása":step===2?pinTitle:"Biztonság kész"
            :"Azonosítás szükséges"}</h1>
        <p>{isVault
          ?"A jelszavaid és PIN-kódjaid külön újraazonosítással védettek."
          :setupMode
            ?step===1
              ?"Az iPhone rendszerazonosítása Face ID-t használ. Ha ez nem érhető el, a tartalék kóddal továbbra is beléphetsz."
              :step===2
                ?"Ez lesz a tartalék feloldási kódod, ha a Face ID éppen nem használható."
                :"A készüléked biztonságos feloldása be van állítva."
            :"Nézz a telefonra a Face ID azonosításhoz, vagy használd a tartalék kódot."}</p>
      </div>

      {message&&<div className="security-v2-message">{message}</div>}

      {setupMode&&step===1&&<div className="security-v2-card">
        <div className="security-v2-feature"><span>✓</span><div><b>Face ID / Passkey</b><small>Az Apple rendszerazonosítása, jelszó nélkül.</small></div></div>
        <div className="security-v2-feature"><span>✓</span><div><b>Nem tárolunk arcadatot</b><small>Az app csak a hitelesítés eredményét kapja meg.</small></div></div>
        {platformReady===false&&<div className="security-v2-browser-note"><b>Safari szükséges</b><span>Nyisd meg a szemelyes-kozpont.vercel.app címet közvetlenül Safariban a Face ID beállításához.</span></div>}
        <button className="security-v2-primary" onClick={()=>biometric("register")} disabled={busy||platformReady===false}>
          {busy?"Face ID előkészítése…":"Face ID / Passkey bekapcsolása"}
        </button>
      </div>}

      {(pinSetup||showPin)&&<div className="security-v2-card pin-card">
        <div className="security-v2-pinhead">
          <div>
            <b>{pinSetup?pinTitle:"Tartalék kód"}</b>
            <small>{pinSetup&&pinStage==="confirm"?"Írd be még egyszer ugyanazt a 6 számjegyet.":"6 számjegy"}</small>
          </div>
          {pinSetup&&<span className="security-v2-stepbadge">2 / 3</span>}
        </div>

        <div className="pin-dots-v2">{Array.from({length:6},(_,i)=><span key={i} className={i<pin.length?"filled":""}/>)}</div>
        <input className="pin-input" aria-label="6 jegyű kód" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))}/>

        <div className="pin-keypad-v2">
          {[1,2,3,4,5,6,7,8,9].map(n=><button key={n} onClick={()=>setPin(v=>(v+String(n)).slice(0,6))}>{n}</button>)}
          <button className="muted-key" onClick={()=>setPin("")}>C</button>
          <button onClick={()=>setPin(v=>(v+"0").slice(0,6))}>0</button>
          <button className="muted-key" onClick={()=>setPin(v=>v.slice(0,-1))}>⌫</button>
        </div>

        <button className="security-v2-primary" disabled={pin.length!==6||busy} onClick={()=>pinSetup?nextSetupPin():verifyPin("verify")}>
          {busy?"Ellenőrzés…":pinSetup?(pinStage==="enter"?"Tovább":"Kód mentése"):"Feloldás kóddal"}
        </button>
      </div>}

      {!setupMode&&!showPin&&<div className="security-v2-actions">
        <button className="security-v2-primary" onClick={()=>biometric("authenticate")} disabled={busy}>
          {busy?"Azonosítás…":"Face ID használata"}
        </button>
        {status.hasPin&&<button className="security-v2-secondary" onClick={()=>setShowPin(true)}>Kód megadása</button>}
      </div>}

      {setupMode&&step===3&&<button className="security-v2-primary" onClick={()=>refresh()}>Belépés az alkalmazásba</button>}

      <div className="security-v2-foot">
        <span className="security-v2-lockdot"/> A biometrikus adat az iPhone-on marad.
      </div>
    </section>
  </main>;
}
