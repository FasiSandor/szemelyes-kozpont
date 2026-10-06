import { requireUser } from "@/lib/neon/session";
import { sql } from "@/lib/neon/db";

type VaultPayload={
  version:1;
  salt:string;
  iv:string;
  cipher:string;
};

function isPayload(value:unknown):value is VaultPayload{
  if(!value||typeof value!=="object") return false;
  const v=value as Record<string,unknown>;
  return v.version===1
    && typeof v.salt==="string" && v.salt.length>0 && v.salt.length<10000
    && typeof v.iv==="string" && v.iv.length>0 && v.iv.length<10000
    && typeof v.cipher==="string" && v.cipher.length>0 && v.cipher.length<2_000_000;
}

export async function GET(){
  try{
    const user=await requireUser();
    const db=sql();
    const rows=await db`
      select cipher_payload,updated_at
      from vault_blobs
      where owner_user_id=${user.id}
      limit 1
    `;
    if(!rows[0]) return Response.json({exists:false});
    return Response.json({
      exists:true,
      payload:rows[0].cipher_payload,
      updatedAt:rows[0].updated_at,
    });
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    return Response.json({error:"Nem sikerült betölteni a titkosított Vaultot."},{status:500});
  }
}

export async function PUT(request:Request){
  try{
    const user=await requireUser();
    const body=await request.json() as {payload?:unknown};
    if(!isPayload(body.payload)){
      return Response.json({error:"Érvénytelen titkosított Vault csomag."},{status:400});
    }

    const db=sql();
    await db`
      insert into vault_blobs(owner_user_id,cipher_payload,updated_at)
      values(${user.id},${JSON.stringify(body.payload)}::jsonb,now())
      on conflict(owner_user_id) do update set
        cipher_payload=excluded.cipher_payload,
        updated_at=now()
    `;

    return Response.json({ok:true});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    return Response.json({error:"Nem sikerült szinkronizálni a titkosított Vaultot."},{status:500});
  }
}
