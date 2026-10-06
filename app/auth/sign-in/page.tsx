"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/neon/auth";

export default function SignInPage() {
  const [mode,setMode]=useState<"signin"|"signup">("signin");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

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
        setMessage("A fiók elkészült. Most beléphetsz.");
      }else{
        const { error }=await authClient.signIn.email({email,password});
        if(error) throw new Error(error.message);
        window.location.href="/";
      }
    }catch(err){
      setMessage(err instanceof Error?err.message:"Nem sikerült a művelet.");
    }finally{
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-card">
      <div className="vault-emblem">⌘</div>
      <div className="eyebrow">SZEMÉLYES KÖZPONT</div>
      <h1>{mode==="signin"?"Belépés":"Fiók létrehozása"}</h1>
      <p className="subtle">Privát családi, pénzügyi és vállalkozói központ.</p>

      <form onSubmit={submit} className="form-card">
        {mode==="signup"&&<input className="input" required placeholder="Név" value={name} onChange={e=>setName(e.target.value)}/>}
        <input className="input" required type="email" autoComplete="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
        <input className="input" required minLength={8} type="password" autoComplete={mode==="signin"?"current-password":"new-password"} placeholder="Jelszó" value={password} onChange={e=>setPassword(e.target.value)}/>
        {message&&<div className="auth-message">{message}</div>}
        <button className="primary-btn" disabled={busy}>{busy?"Dolgozom…":mode==="signin"?"Belépés":"Regisztráció"}</button>
      </form>

      <button className="auth-switch" onClick={()=>{setMode(mode==="signin"?"signup":"signin");setMessage("");}}>
        {mode==="signin"?"Még nincs fiókod? Regisztráció":"Van már fiókod? Belépés"}
      </button>
    </section>
  </main>;
}
