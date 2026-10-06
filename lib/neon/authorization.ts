import { getOrCreateHousehold } from "@/lib/neon/household";
import { sql } from "@/lib/neon/db";

export type HouseholdRole="owner"|"family"|"accountant";

export async function requireHouseholdRole(allowed:HouseholdRole[]){
  const {user,household}=await getOrCreateHousehold();
  const db=sql();
  const rows=await db`
    select role
    from household_memberships
    where household_id=${household.id} and user_id=${user.id}
    limit 1
  `;
  const role=rows[0]?.role as HouseholdRole|undefined;
  if(!role||!allowed.includes(role)) throw new Error("FORBIDDEN");
  return {user,household,role};
}
