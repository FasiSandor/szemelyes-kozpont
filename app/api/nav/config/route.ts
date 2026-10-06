import { getNavIntegration, saveNavIntegration } from "@/lib/nav/integration";

export async function GET(){
  try{
    const {integration}=await getNavIntegration();
    if(!integration) return Response.json({configured:false});
    return Response.json({
      configured:true,
      businessName:integration.business_name,
      taxNumber:integration.tax_number,
      lastSyncAt:integration.last_sync_at,
      lastSyncStatus:integration.last_sync_status,
      lastError:integration.last_error,
    });
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    if(error instanceof Error&&error.message==="FORBIDDEN"){
      return Response.json({error:"Ehhez nincs jogosultságod."},{status:403});
    }
    return Response.json({error:"Nem sikerült betölteni a NAV kapcsolatot."},{status:500});
  }
}

export async function PUT(request:Request){
  try{
    const body=await request.json() as {
      businessName?:string;
      taxNumber?:string;
      login?:string;
      password?:string;
      signKey?:string;
    };
    await saveNavIntegration({
      businessName:body.businessName?.trim()||"Egyéni vállalkozás",
      taxNumber:body.taxNumber||"",
      login:body.login||"",
      password:body.password||"",
      signKey:body.signKey||"",
    });
    return Response.json({ok:true});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED"){
      return Response.json({error:"Nincs bejelentkezve."},{status:401});
    }
    if(error instanceof Error&&error.message==="FORBIDDEN"){
      return Response.json({error:"Csak a tulajdonos állíthatja be a NAV kapcsolatot."},{status:403});
    }
    if(error instanceof Error&&error.message==="INVALID_TAX_NUMBER"){
      return Response.json({error:"Az adószám első 8 számjegye szükséges."},{status:400});
    }
    if(error instanceof Error&&error.message==="MISSING_NAV_CREDENTIALS"){
      return Response.json({error:"Hiányzik a NAV technikai felhasználó valamelyik adata."},{status:400});
    }
    return Response.json({error:"Nem sikerült menteni a NAV kapcsolatot."},{status:500});
  }
}
