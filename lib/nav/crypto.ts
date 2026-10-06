import { createCipheriv, createDecipheriv } from "node:crypto";

type NavCredentials={
  login:string;
  password:string;
  signKey:string;
};

type CipherPayload={
  v:1;
  iv:string;
  tag:string;
  cipher:string;
};

function key(){
  const raw=process.env.NAV_CREDENTIALS_KEY;
  if(!raw) throw new Error("NAV_CREDENTIALS_KEY nincs beállítva.");
  const buf=Buffer.from(raw,"base64");
  if(buf.length!==32) throw new Error("NAV_CREDENTIALS_KEY hibás hosszúságú.");
  return buf;
}

export function encryptNavCredentials(value:NavCredentials):CipherPayload{
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=createCipheriv("aes-256-gcm",key(),Buffer.from(iv));
  const encrypted=Buffer.concat([
    cipher.update(JSON.stringify(value),"utf8"),
    cipher.final()
  ]);
  return {
    v:1,
    iv:Buffer.from(iv).toString("base64"),
    tag:cipher.getAuthTag().toString("base64"),
    cipher:encrypted.toString("base64"),
  };
}

export function decryptNavCredentials(payload:unknown):NavCredentials{
  const p=payload as CipherPayload;
  if(!p||p.v!==1||!p.iv||!p.tag||!p.cipher) throw new Error("Érvénytelen NAV titkosított adat.");
  const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(p.iv,"base64"));
  decipher.setAuthTag(Buffer.from(p.tag,"base64"));
  const plain=Buffer.concat([
    decipher.update(Buffer.from(p.cipher,"base64")),
    decipher.final()
  ]).toString("utf8");
  const value=JSON.parse(plain) as NavCredentials;
  if(!value.login||!value.password||!value.signKey) throw new Error("Hiányos NAV hitelesítő adat.");
  return value;
}
