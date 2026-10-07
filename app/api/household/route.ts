import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getOrCreateHousehold } from "@/lib/neon/household";
import { sql } from "@/lib/neon/db";
import { DOCUMENT_BUCKET, storageClient } from "@/lib/neon/storage";

export async function GET(){
  try{
    const {household}=await getOrCreateHousehold();
    const db=sql();
    const rows=await db`
      select id,display_name,relation,linked_user_id,created_at
      from family_members
      where household_id=${household.id}
      order by created_at asc
    `;
    const s3=storageClient();
    const members=await Promise.all(rows.map(async (member:any)=>({
      ...member,
      profile_url:await getSignedUrl(
        s3,
        new GetObjectCommand({Bucket:DOCUMENT_BUCKET,Key:`profiles/${household.id}/${member.id}`}),
        {expiresIn:300}
      )
    })));
    return Response.json({household,members});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    if(error instanceof Error&&error.message==="STORAGE_NOT_CONFIGURED"){
      return Response.json({error:"A privát tárhely még nincs az apphoz kötve."},{status:503});
    }
    return Response.json({error:"Nem sikerült betölteni a családi teret."},{status:500});
  }
}

export async function POST(request:Request){
  try{
    const {household}=await getOrCreateHousehold();
    const body=await request.json() as {
      action?:"profilePrepare";
      familyMemberId?:string;
      contentType?:string;
      displayName?:string;
      relation?:string;
    };
    const db=sql();

    if(body.action==="profilePrepare"){
      if(!body.familyMemberId||!body.contentType?.startsWith("image/")){
        return Response.json({error:"Hiányzó vagy érvénytelen profilkép."},{status:400});
      }
      const allowed=await db`
        select 1 from family_members
        where id=${body.familyMemberId} and household_id=${household.id}
        limit 1
      `;
      if(!allowed.length) return Response.json({error:"Nincs hozzáférés ehhez a családtaghoz."},{status:403});
      const s3=storageClient();
      const key=`profiles/${household.id}/${body.familyMemberId}`;
      const uploadUrl=await getSignedUrl(
        s3,
        new PutObjectCommand({Bucket:DOCUMENT_BUCKET,Key:key,ContentType:body.contentType}),
        {expiresIn:300}
      );
      return Response.json({uploadUrl,key});
    }

    const displayName=body.displayName?.trim();
    if(!displayName) return Response.json({error:"A név kötelező."},{status:400});
    const rows=await db`
      insert into family_members(household_id,display_name,relation)
      values(${household.id},${displayName},${body.relation?.trim()||"Családtag"})
      returning id,display_name,relation,linked_user_id,created_at
    `;
    return Response.json({member:rows[0]},{status:201});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    if(error instanceof Error&&error.message==="STORAGE_NOT_CONFIGURED"){
      return Response.json({error:"A privát tárhely még nincs az apphoz kötve."},{status:503});
    }
    return Response.json({error:"Nem sikerült a családi művelet."},{status:500});
  }
}
