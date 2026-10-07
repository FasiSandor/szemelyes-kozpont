import { createSign } from "node:crypto";

const API="https://api.enablebanking.com";

function b64url(input:string|Buffer){
  return Buffer.from(input).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}

function privateKey(){
  const raw=process.env.ENABLE_BANKING_PRIVATE_KEY;
  if(!raw)throw new Error("ENABLE_BANKING_NOT_CONFIGURED");
  return raw.replace(/\\n/g,"\n");
}

export function enableBankingConfigured(){
  return Boolean(process.env.ENABLE_BANKING_APP_ID&&process.env.ENABLE_BANKING_PRIVATE_KEY);
}

export function enableBankingJwt(){
  const appId=process.env.ENABLE_BANKING_APP_ID;
  if(!appId)throw new Error("ENABLE_BANKING_NOT_CONFIGURED");
  const iat=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({typ:"JWT",alg:"RS256",kid:appId}));
  const body=b64url(JSON.stringify({iss:"enablebanking.com",aud:"api.enablebanking.com",iat,exp:iat+3600}));
  const unsigned=header+"."+body;
  const signer=createSign("RSA-SHA256");
  signer.update(unsigned);signer.end();
  const signature=signer.sign(privateKey());
  return unsigned+"."+b64url(signature);
}

export async function ebRequest(path:string,init?:RequestInit){
  const res=await fetch(API+path,{
    ...init,
    headers:{
      accept:"application/json",
      authorization:"Bearer "+enableBankingJwt(),
      ...(init?.body?{"content-type":"application/json"}:{}),
      ...(init?.headers||{})
    },
    cache:"no-store"
  });
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(json.detail||json.message||json.error||("Enable Banking HTTP "+res.status));
  return json;
}

export async function findOtpHungary(){
  const data=await ebRequest("/aspsps?country=HU");
  const list=Array.isArray(data)?data:Array.isArray(data?.aspsps)?data.aspsps:[];
  const otp=list.find((x:any)=>String(x?.name||"").toLowerCase().includes("otp"));
  if(!otp)throw new Error("OTP_BANK_NOT_FOUND");
  return otp;
}
