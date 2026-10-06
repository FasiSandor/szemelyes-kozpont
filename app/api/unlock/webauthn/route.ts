import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { requireUser } from "@/lib/neon/session";
import { sql } from "@/lib/neon/db";
import { issueUnlock } from "@/lib/unlock/session";

function rp(request:Request){
  const url=new URL(request.url);
  return {
    rpID:process.env.WEBAUTHN_RP_ID||url.hostname,
    origin:process.env.WEBAUTHN_ORIGIN||url.origin,
  };
}
function toUint8(value:unknown): Uint8Array<ArrayBuffer> {
  if(value instanceof Uint8Array) return Uint8Array.from(value);
  if(typeof value==="string"){
    if(value.startsWith("\\x")) return Uint8Array.from(Buffer.from(value.slice(2),"hex"));
    return Uint8Array.from(Buffer.from(value,"base64"));
  }
  if(Buffer.isBuffer(value)) return Uint8Array.from(value);
  throw new Error("INVALID_PUBLIC_KEY");
}
export async function GET(request:Request){
  try{
    const user=await requireUser();
    const {searchParams}=new URL(request.url);
    const mode=searchParams.get("mode");
    const db=sql();
    const {rpID}=rp(request);
    const existing=await db`select credential_id,transports from app_unlock_credentials where user_id=${user.id}`;

    if(mode==="register"){
      const options=await generateRegistrationOptions({
        rpName:"Személyes Központ",
        rpID,
        userName:user.email||user.id,
        userDisplayName:user.name||user.email||"Felhasználó",
        userID:isoUint8Array.fromUTF8String(user.id),
        attestationType:"none",
        excludeCredentials:existing.map((row:any)=>({
          id:row.credential_id,
          transports:(row.transports||[]) as any,
        })),
        authenticatorSelection:{
          authenticatorAttachment:"platform",
          residentKey:"preferred",
          userVerification:"required",
        },
      });
      await db`
        insert into app_unlock_challenges(user_id,purpose,challenge,expires_at)
        values(${user.id},'register',${options.challenge},now()+interval '5 minutes')
        on conflict(user_id,purpose) do update set challenge=excluded.challenge,expires_at=excluded.expires_at
      `;
      return Response.json(options);
    }

    const options=await generateAuthenticationOptions({
      rpID,
      userVerification:"required",
      allowCredentials:existing.map((row:any)=>({
        id:row.credential_id,
        transports:(row.transports||[]) as any,
      })),
    });
    await db`
      insert into app_unlock_challenges(user_id,purpose,challenge,expires_at)
      values(${user.id},'authenticate',${options.challenge},now()+interval '5 minutes')
      on conflict(user_id,purpose) do update set challenge=excluded.challenge,expires_at=excluded.expires_at
    `;
    return Response.json(options);
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED") return Response.json({error:"Nincs bejelentkezve."},{status:401});
    return Response.json({error:"Nem sikerült előkészíteni a Face ID-t."},{status:500});
  }
}

export async function POST(request:Request){
  try{
    const user=await requireUser();
    const body=await request.json() as {action:"register"|"authenticate";response:any};
    const db=sql();
    const {rpID,origin}=rp(request);
    const purpose=body.action==="register"?"register":"authenticate";
    const challenges=await db`
      select challenge from app_unlock_challenges
      where user_id=${user.id} and purpose=${purpose} and expires_at>now()
      limit 1
    `;
    const challenge=challenges[0]?.challenge as string|undefined;
    await db`delete from app_unlock_challenges where user_id=${user.id} and purpose=${purpose}`;
    if(!challenge) return Response.json({error:"A Face ID kérés lejárt. Próbáld újra."},{status:400});

    if(body.action==="register"){
      const verification=await verifyRegistrationResponse({
        response:body.response,
        expectedChallenge:challenge,
        expectedOrigin:origin,
        expectedRPID:rpID,
        requireUserVerification:true,
      });
      if(!verification.verified||!verification.registrationInfo) return Response.json({verified:false},{status:400});
      const {credential,credentialDeviceType,credentialBackedUp}=verification.registrationInfo;
      const transports=body.response?.response?.transports||[];
      await db`
        insert into app_unlock_credentials(
          user_id,credential_id,public_key,counter,transports,device_type,backed_up,label,last_used_at
        ) values(
          ${user.id},${credential.id},${Buffer.from(credential.publicKey)},${credential.counter},
          ${transports},${credentialDeviceType},${credentialBackedUp},'Face ID / Passkey',now()
        )
        on conflict(credential_id) do update set
          public_key=excluded.public_key,
          counter=excluded.counter,
          transports=excluded.transports,
          device_type=excluded.device_type,
          backed_up=excluded.backed_up,
          last_used_at=now()
      `;
      await issueUnlock(user.id);
      return Response.json({verified:true});
    }

    const credentialRows=await db`
      select credential_id,public_key,counter,transports
      from app_unlock_credentials
      where user_id=${user.id} and credential_id=${body.response?.id}
      limit 1
    `;
    const credentialRow=credentialRows[0] as any;
    if(!credentialRow) return Response.json({error:"Ehhez az eszközhöz nincs regisztrált Face ID."},{status:404});

    const verification=await verifyAuthenticationResponse({
      response:body.response,
      expectedChallenge:challenge,
      expectedOrigin:origin,
      expectedRPID:rpID,
      requireUserVerification:true,
      credential:{
        id:credentialRow.credential_id,
        publicKey:toUint8(credentialRow.public_key),
        counter:Number(credentialRow.counter||0),
        transports:(credentialRow.transports||[]) as any,
      },
    });
    if(!verification.verified) return Response.json({verified:false},{status:401});
    await db`
      update app_unlock_credentials
      set counter=${verification.authenticationInfo.newCounter},last_used_at=now()
      where credential_id=${credentialRow.credential_id}
    `;
    await issueUnlock(user.id);
    return Response.json({verified:true});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED") return Response.json({error:"Nincs bejelentkezve."},{status:401});
    return Response.json({error:error instanceof Error?error.message:"A Face ID ellenőrzés sikertelen."},{status:400});
  }
}
