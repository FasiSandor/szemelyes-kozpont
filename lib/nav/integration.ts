import { requireHouseholdRole } from "@/lib/neon/authorization";
import { sql } from "@/lib/neon/db";
import { decryptNavCredentials, encryptNavCredentials } from "@/lib/nav/crypto";

export type NavIntegration={
  id:string;
  household_id:string;
  business_id:string;
  tax_number:string;
  credentials_cipher:unknown;
  last_sync_at:string|null;
  last_sync_status:string|null;
  last_error:string|null;
  business_name:string;
};

export async function getNavIntegration(){
  const {user,household,role}=await requireHouseholdRole(["owner","accountant"]);
  const db=sql();
  const rows=await db`
    select ni.id,ni.household_id,ni.business_id,ni.tax_number,ni.credentials_cipher,
           ni.last_sync_at,ni.last_sync_status,ni.last_error,b.name as business_name
    from nav_integrations ni
    join businesses b on b.id=ni.business_id
    where ni.household_id=${household.id}
    limit 1
  `;
  return {user,household,role,integration:rows[0] as NavIntegration|undefined};
}

export async function getNavAuth(){
  const ctx=await getNavIntegration();
  const integration=ctx.integration;
  if(!integration) throw new Error("NAV_NOT_CONFIGURED");
  const creds=decryptNavCredentials(integration.credentials_cipher);
  return {
    user:ctx.user,
    household:ctx.household,
    role:ctx.role,
    integration,
    auth:{
      login:creds.login,
      password:creds.password,
      signKey:creds.signKey,
      taxNumber:integration.tax_number,
    }
  };
}

export async function saveNavIntegration(input:{
  businessName:string;
  taxNumber:string;
  login:string;
  password:string;
  signKey:string;
}){
  const {user,household}=await requireHouseholdRole(["owner"]);
  const db=sql();
  const tax=input.taxNumber.replace(/\D/g,"").slice(0,8);
  if(tax.length!==8) throw new Error("INVALID_TAX_NUMBER");
  if(!input.login.trim()||!input.password.trim()||!input.signKey.trim()) throw new Error("MISSING_NAV_CREDENTIALS");

  const existingBusiness=await db`
    select id from businesses
    where household_id=${household.id} and active=true
    order by created_at asc
    limit 1
  `;
  let businessId=existingBusiness[0]?.id as string|undefined;
  if(!businessId){
    const created=await db`
      insert into businesses(household_id,name,active)
      values(${household.id},${input.businessName.trim()||"Egyéni vállalkozás"},true)
      returning id
    `;
    businessId=created[0].id as string;
  }else{
    await db`
      update businesses set name=${input.businessName.trim()||"Egyéni vállalkozás"}
      where id=${businessId} and household_id=${household.id}
    `;
  }

  const cipher=encryptNavCredentials({
    login:input.login.trim(),
    password:input.password,
    signKey:input.signKey.trim(),
  });

  await db`
    insert into nav_integrations(
      household_id,business_id,tax_number,credentials_cipher,updated_at,last_sync_status,last_error
    ) values(
      ${household.id},${businessId},${tax},${JSON.stringify(cipher)}::jsonb,now(),'configured',null
    )
    on conflict(household_id) do update set
      business_id=excluded.business_id,
      tax_number=excluded.tax_number,
      credentials_cipher=excluded.credentials_cipher,
      updated_at=now(),
      last_sync_status='configured',
      last_error=null
  `;

  await db`
    insert into audit_log(household_id,actor_user_id,action,entity_type,entity_id)
    values(${household.id},${user.id},'configure','nav_integration',${businessId})
  `;

  return {household,businessId,taxNumber:tax};
}
