import { requireUser } from "@/lib/neon/session";
import { sql } from "@/lib/neon/db";

export async function getOrCreateHousehold(){
  const user=await requireUser();
  const db=sql();

  const existing=await db`
    select h.id,h.name
    from households h
    join household_memberships hm on hm.household_id=h.id
    where hm.user_id=${user.id}
    order by h.created_at asc
    limit 1
  `;
  if(existing[0]) return {user,household:existing[0] as {id:string;name:string}};

  const rows=await db`
    insert into households(name,owner_user_id)
    values('Személyes Központ',${user.id})
    returning id,name
  `;
  const household=rows[0] as {id:string;name:string};

  await db`
    insert into household_memberships(household_id,user_id,role,display_name)
    values(${household.id},${user.id},'owner',${user.name||user.email||"Tulajdonos"})
  `;

  await db`
    insert into family_members(household_id,linked_user_id,display_name,relation)
    values(${household.id},${user.id},${user.name||"Sándor"},'Saját')
  `;

  return {user,household};
}
