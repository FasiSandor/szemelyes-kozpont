import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireHouseholdRole } from "@/lib/neon/authorization";
import { sql } from "@/lib/neon/db";
import { DOCUMENT_BUCKET, storageClient } from "@/lib/neon/storage";

const validKinds=new Set([
  "identity","address","tax","health","student","teacher",
  "vehicle","insurance","contract","bank_card","loyalty_card","membership_card","shopping_card","other"
]);
const validSides=new Set(["front","back","page"]);

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
      select d.id,d.document_group_id,d.side,d.page_index,d.family_member_id,d.kind,d.title,
             d.issue_date,d.expiry_date,d.note,d.metadata,d.storage_key,d.created_at,
             fm.display_name as member_name
      from documents d
      join family_members fm on fm.id=d.family_member_id
      where d.household_id=${household.id}
      order by d.created_at desc
    `;
    const s3=storageClient();
    const photos=await Promise.all(rows.map(async (row:any)=>({
      ...row,
      imageUrl:await getSignedUrl(
        s3,
        new GetObjectCommand({Bucket:DOCUMENT_BUCKET,Key:row.storage_key}),
        {expiresIn:300}
      )
    })));

    const grouped=new Map<string,any>();
    for(const photo of photos){
      const key=photo.document_group_id;
      const current=grouped.get(key)??{
        id:key,
        family_member_id:photo.family_member_id,
        kind:photo.kind,
        title:photo.title,
        issue_date:photo.issue_date,
        expiry_date:photo.expiry_date,
        note:photo.note,
        metadata:photo.metadata||{},
        created_at:photo.created_at,
        member_name:photo.member_name,
        front:null,
        back:null,
        pages:[],
      };
      const item={
        id:photo.id,
        imageUrl:photo.imageUrl,
        storageKey:photo.storage_key,
        pageIndex:Number(photo.page_index||1),
        side:photo.side,
      };
      current.pages.push(item);
      if(photo.side==="front") current.front=item;
      if(photo.side==="back") current.back=item;
      if(new Date(photo.created_at)>new Date(current.created_at)) current.created_at=photo.created_at;
      grouped.set(key,current);
    }

    const documents=Array.from(grouped.values()).map((doc:any)=>({
      ...doc,
      pages:(doc.pages||[]).sort((a:any,b:any)=>a.pageIndex-b.pageIndex)
    }));
    return Response.json({documents});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    if(error instanceof Error&&error.message==="FORBIDDEN"){
      return Response.json({error:"Ehhez a művelethez nincs jogosultság."},{status:403});
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
      documentGroupId?:string;
      side?:string;
      pageIndex?:number;
      metadata?:Record<string,unknown>;
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

      const groupId=body.documentGroupId||crypto.randomUUID();
      const side=validSides.has(body.side||"")?body.side!:"page";
      const pageIndex=Math.max(1,Math.min(999,Number(body.pageIndex||1)));
      const key=`${household.id}/${body.familyMemberId}/${groupId}-p${pageIndex}-${side}-${crypto.randomUUID()}.${extFor(body.contentType)}`;
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
      return Response.json({documentGroupId:groupId,storageKey:key,uploadUrl,side,pageIndex});
    }

    if(body.action==="finalize"){
      if(!body.familyMemberId||!body.storageKey||!body.title?.trim()||!body.documentGroupId){
        return Response.json({error:"Hiányzó iratadat."},{status:400});
      }
      const expectedPrefix=`${household.id}/${body.familyMemberId}/`;
      if(!body.storageKey.startsWith(expectedPrefix)){
        return Response.json({error:"Érvénytelen tárhely-kulcs."},{status:403});
      }
      const kind=validKinds.has(body.kind||"")?body.kind!:"other";
      const side=validSides.has(body.side||"")?body.side!:"page";
      const pageIndex=Math.max(1,Math.min(999,Number(body.pageIndex||1)));
      const metadata=body.metadata&&typeof body.metadata==="object"?body.metadata:{};

      const rows=await db`
        insert into documents(
          household_id,family_member_id,document_group_id,side,page_index,kind,title,
          storage_bucket,storage_key,issue_date,expiry_date,note,metadata,created_by_user_id
        ) values(
          ${household.id},${body.familyMemberId},${body.documentGroupId}::uuid,${side},${pageIndex},
          ${kind}::document_kind,${body.title.trim()},${DOCUMENT_BUCKET},${body.storageKey},
          ${body.issueDate||null},${body.expiryDate||null},${body.note||null},${JSON.stringify(metadata)}::jsonb,${user.id}
        )
        returning id,document_group_id,side,page_index,created_at
      `;
      return Response.json({document:rows[0]},{status:201});
    }

    return Response.json({error:"Ismeretlen művelet."},{status:400});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    if(error instanceof Error&&error.message==="FORBIDDEN"){
      return Response.json({error:"Ehhez a művelethez nincs jogosultság."},{status:403});
    }
    if(error instanceof Error&&error.message==="STORAGE_NOT_CONFIGURED"){
      return Response.json({error:"A privát tárhely még nincs az apphoz kötve."},{status:503});
    }
    return Response.json({error:"Nem sikerült az irat művelet."},{status:500});
  }
}

export async function DELETE(request:Request){
  try{
    const {user,household}=await requireHouseholdRole(["owner","family"]);
    const {searchParams}=new URL(request.url);
    const groupId=searchParams.get("groupId");
    if(!groupId) return Response.json({error:"Hiányzik a dokumentum azonosító."},{status:400});

    const db=sql();
    const rows=await db`
      select id,storage_key
      from documents
      where household_id=${household.id} and document_group_id=${groupId}::uuid
    `;
    if(!rows.length) return Response.json({error:"Az irat nem található."},{status:404});

    const s3=storageClient();
    await Promise.all(rows.map((row:any)=>
      s3.send(new DeleteObjectCommand({Bucket:DOCUMENT_BUCKET,Key:row.storage_key}))
    ));

    await db`
      delete from documents
      where household_id=${household.id} and document_group_id=${groupId}::uuid
    `;
    await db`
      insert into audit_log(household_id,actor_user_id,action,entity_type,entity_id)
      values(${household.id},${user.id},'delete','document_group',${groupId})
    `;

    return Response.json({ok:true});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    if(error instanceof Error&&error.message==="FORBIDDEN"){
      return Response.json({error:"Ehhez a művelethez nincs jogosultság."},{status:403});
    }
    if(error instanceof Error&&error.message==="STORAGE_NOT_CONFIGURED"){
      return Response.json({error:"A privát tárhely még nincs az apphoz kötve."},{status:503});
    }
    return Response.json({error:"Nem sikerült törölni az iratot."},{status:500});
  }
}
