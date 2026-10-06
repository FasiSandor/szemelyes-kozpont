"use client";

import { FormEvent, useEffect, useState } from "react";
import { authClient } from "@/lib/neon/auth";

export default function SignInPage() {
  const [mode,setMode]=useState<"signin"|"signup">("signin");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const { data }=await authClient.getSession();
        if(active&&data?.user) window.location.replace("/");
      }catch{
        // A lejárt vagy hiányzó session normális állapot a belépőoldalon.
      }
    })();
    return()=>{active=false;};
  },[]);

  async function submit(e:FormEvent){
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try{
      if(mode==="signup"){
        const { error }=await authClient.signUp.email({
          name:name.trim()||"Felhasználó",
          email,
          password,
        });
        if(error) throw new Error(error.message);
        setMode("signin");
        setPassword("");
        setMessage("A fiók elkészült. Most jelentkezz be.");
      }else{
        const { error }=await authClient.signIn.email({email,password});
        if(error) throw new Error(error.message);
        window.location.replace("/");
      }
    }catch(err){
      setMessage(err instanceof Error?err.message:"Nem sikerült a művelet.");
    }finally{
      setBusy(false);
    }
  }

  return <main className="auth-v2">
    <div className="auth-v2-aurora a"/>
    <div className="auth-v2-aurora b"/>

    <section className="auth-v2-shell">
      <header className="auth-v2-brand">
        <div className="auth-v2-logo">
          <img src="/icon.svg" alt="" />
        </div>
        <div>
          <div className="auth-v2-kicker">PRIVATE DIGITAL VAULT</div>
          <h1>Személyes Központ</h1>
        </div>
      </header>

      <div className="auth-v2-card">
        <div className="auth-v2-securityline">
          <span className="auth-v2-dot"/>
          Titkosított · Privát · Többeszközös
        </div>

        <div className="auth-v2-heading">
          <h2>{mode==="signin"?"Üdv újra":"Hozd létre a privát tered"}</h2>
          <p>{mode==="signin"
            ?"Lépj be a családi, pénzügyi és vállalkozói központodba."
            :"Egy biztonságos hely az iratoknak, pénzügyeknek és fontos adatoknak."}</p>
        </div>

        <div className="auth-v2-tabs" role="tablist">
          <button type="button" className={mode==="signin"?"on":""} onClick={()=>{setMode("signin");setMessage("");}}>Belépés</button>
          <button type="button" className={mode==="signup"?"on":""} onClick={()=>{setMode("signup");setMessage("");}}>Regisztráció</button>
        </div>

        <form onSubmit={submit} className="auth-v2-form">
          {mode==="signup"&&<label className="auth-v2-field">
            <span>Név</span>
            <input required autoComplete="name" placeholder="A neved" value={name} onChange={e=>setName(e.target.value)}/>
          </label>}

          <label className="auth-v2-field">
            <span>Email</span>
            <input required type="email" autoComplete="email" placeholder="nev@email.hu" value={email} onChange={e=>setEmail(e.target.value)}/>
          </label>

          <label className="auth-v2-field">
            <span>Jelszó</span>
            <input required minLength={8} type="password" autoComplete={mode==="signin"?"current-password":"new-password"} placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}/>
          </label>

          {message&&<div className="auth-v2-message">{message}</div>}

          <button className="auth-v2-primary" disabled={busy}>
            <span>{busy?"Dolgozom…":mode==="signin"?"Belépés":"Fiók létrehozása"}</span>
            <span aria-hidden>→</span>
          </button>
        </form>

        <div className="auth-v2-trust">
          <div><span>✓</span> Face ID / Passkey</div>
          <div><span>✓</span> 6 jegyű tartalék kód</div>
          <div><span>✓</span> Privát irattár</div>
        </div>
      </div>

      <p className="auth-v2-foot">Az érzékeny adatok nem kerülnek a GitHubra. A jelszótár külön titkosított védelemmel működik.</p>
    </section>
  </main>;
}
