import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireHouseholdRole } from "@/lib/neon/authorization";
import { sql } from "@/lib/neon/db";
import { DOCUMENT_BUCKET, storageClient } from "@/lib/neon/storage";

function extFor(type:string){
  if(type==="image/png") return "png";
  if(type==="image/webp") return "webp";
  if(type==="image/heic"||type==="image/heif") return "heic";
  return "jpg";
}

export async function GET(){
  try{
    const {household}=await requireHouseholdRole(["owner","family"]);
    const db=sql();
    const rows=await db`
      select d.id,d.family_member_id,d.kind,d.title,d.issue_date,d.expiry_date,d.note,d.storage_key,d.created_at,
             fm.display_name as member_name
      from documents d
      join family_members fm on fm.id=d.family_member_id
      where d.household_id=${household.id}
      order by d.created_at desc
    `;
    const s3=storageClient();
    const documents=await Promise.all(rows.map(async (row:any)=>({
      ...row,
      imageUrl:await getSignedUrl(
        s3,
        new GetObjectCommand({Bucket:DOCUMENT_BUCKET,Key:row.storage_key}),
        {expiresIn:300}
      )
    })));
    return Response.json({documents});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    if(error instanceof Error&&error.message==="STORAGE_NOT_CONFIGURED"){
      return Response.json({error:"A privát tárhely még nincs az apphoz kötve."},{status:503});
    }
    return Response.json({error:"Nem sikerült betölteni az iratokat."},{status:500});
  }
}

export async function POST(request:Request){
  try{
    const {user,household}=await requireHouseholdRole(["owner","family"]);
    const body=await request.json() as {
      action?:"prepare"|"finalize";
      familyMemberId?:string;
      title?:string;
      kind?:string;
      contentType?:string;
      storageKey?:string;
      issueDate?:string|null;
      expiryDate?:string|null;
      note?:string|null;
    };
    const db=sql();

    if(body.action==="prepare"){
      if(!body.familyMemberId||!body.title?.trim()||!body.contentType){
        return Response.json({error:"Hiányzó iratadat."},{status:400});
      }
      const allowed=await db`
        select 1 from family_members
        where id=${body.familyMemberId} and household_id=${household.id}
        limit 1
      `;
      if(!allowed.length) return Response.json({error:"Nincs hozzáférés ehhez a családtaghoz."},{status:403});

      const key=`${household.id}/${body.familyMemberId}/${crypto.randomUUID()}.${extFor(body.contentType)}`;
      const s3=storageClient();
      const uploadUrl=await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket:DOCUMENT_BUCKET,
          Key:key,
          ContentType:body.contentType,
        }),
        {expiresIn:300}
      );
      return Response.json({storageKey:key,uploadUrl});
    }

    if(body.action==="finalize"){
      if(!body.familyMemberId||!body.storageKey||!body.title?.trim()){
        return Response.json({error:"Hiányzó iratadat."},{status:400});
      }
      const expectedPrefix=`${household.id}/${body.familyMemberId}/`;
      if(!body.storageKey.startsWith(expectedPrefix)){
        return Response.json({error:"Érvénytelen tárhely-kulcs."},{status:403});
      }

      const rows=await db`
        insert into documents(
          household_id,family_member_id,kind,title,storage_bucket,storage_key,
          issue_date,expiry_date,note,created_by_user_id
        ) values(
          ${household.id},
          ${body.familyMemberId},
          ${body.kind||"other"}::document_kind,
          ${body.title.trim()},
          ${DOCUMENT_BUCKET},
          ${body.storageKey},
          ${body.issueDate||null},
          ${body.expiryDate||null},
          ${body.note||null},
          ${user.id}
        )
        returning id,created_at
      `;
      return Response.json({document:rows[0]},{status:201});
    }

    return Response.json({error:"Ismeretlen művelet."},{status:400});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    if(error instanceof Error&&error.message==="STORAGE_NOT_CONFIGURED"){
      return Response.json({error:"A privát tárhely még nincs az apphoz kötve."},{status:503});
    }
    return Response.json({error:"Nem sikerült az irat művelet."},{status:500});
  }
}
