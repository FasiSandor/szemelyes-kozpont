const BASE="https://bankaccountdata.gocardless.com/api/v2";

let cached:{access:string;expiresAt:number}|null=null;

export function openBankingConfigured(){
  return Boolean(process.env.GOCARDLESS_SECRET_ID&&process.env.GOCARDLESS_SECRET_KEY);
}

export async function gcAccessToken(){
  if(cached&&cached.expiresAt>Date.now()+60_000)return cached.access;
  const secret_id=process.env.GOCARDLESS_SECRET_ID;
  const secret_key=process.env.GOCARDLESS_SECRET_KEY;
  if(!secret_id||!secret_key)throw new Error("OPEN_BANKING_NOT_CONFIGURED");
  const res=await fetch(BASE+"/token/new/",{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json"},
    body:JSON.stringify({secret_id,secret_key}),
    cache:"no-store"
  });
  const json=await res.json();
  if(!res.ok)throw new Error(json.detail||json.summary||"GoCardless token hiba");
  cached={access:json.access,expiresAt:Date.now()+Number(json.access_expires||86400)*1000};
  return json.access as string;
}

export async function gcRequest(path:string,init?:RequestInit){
  const access=await gcAccessToken();
  const res=await fetch(BASE+path,{
    ...init,
    headers:{
      "accept":"application/json",
      ...(init?.body?{"content-type":"application/json"}:{}),
      "authorization":"Bearer "+access,
      ...(init?.headers||{})
    },
    cache:"no-store"
  });
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(json.detail||json.summary||("Open Banking HTTP "+res.status));
  return json;
}

export const OTP_HU_INSTITUTION="OTP_BANK_OTPVHUHB";
