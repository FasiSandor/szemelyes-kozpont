import { getOrCreateHousehold } from "@/lib/neon/household";
import { sql } from "@/lib/neon/db";

export async function GET(){
  try{
    const {household}=await getOrCreateHousehold();
    const db=sql();
    const members=await db`
      select id,display_name,relation,linked_user_id,created_at
      from family_members
      where household_id=${household.id}
      order by created_at asc
    `;
    return Response.json({household,members});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    return Response.json({error:"Nem sikerült betölteni a családi teret."},{status:500});
  }
}

export async function POST(request:Request){
  try{
    const {household}=await getOrCreateHousehold();
    const body=await request.json() as {displayName?:string;relation?:string};
    const displayName=body.displayName?.trim();
    if(!displayName) return Response.json({error:"A név kötelező."},{status:400});
    const db=sql();
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
    return Response.json({error:"Nem sikerült hozzáadni a családtagot."},{status:500});
  }
}
