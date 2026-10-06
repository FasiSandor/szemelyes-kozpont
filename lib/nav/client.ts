import { createHash, randomBytes } from "node:crypto";
import { XMLParser } from "fast-xml-parser";

export type NavAuth={
  login:string;
  password:string;
  signKey:string;
  taxNumber:string;
};

export type NavInvoiceDigest={
  invoiceNumber:string;
  batchIndex:number|null;
  invoiceOperation:string;
  invoiceCategory:string|null;
  invoiceIssueDate:string;
  supplierTaxNumber:string|null;
  supplierName:string|null;
  customerTaxNumber:string|null;
  customerName:string|null;
  paymentMethod:string|null;
  paymentDate:string|null;
  invoiceDelivery:string|null;
  invoiceAppearance:string|null;
  source:string|null;
  currency:string;
  invoiceNetAmount:number|null;
  invoiceNetAmountHUF:number|null;
  invoiceVatAmount:number|null;
  invoiceVatAmountHUF:number|null;
  transactionId:string|null;
  index:number|null;
  originalInvoiceNumber:string|null;
  raw:unknown;
};

const API="https://api.onlineszamla.nav.gov.hu/invoiceService/v3";
const parser=new XMLParser({
  ignoreAttributes:false,
  removeNSPrefix:true,
  parseTagValue:true,
  trimValues:true,
});

function xml(value:unknown){
  return String(value??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&apos;");
}

function upperHash(algorithm:string,value:string){
  return createHash(algorithm).update(value,"utf8").digest("hex").toUpperCase();
}

function requestContext(auth:NavAuth){
  const now=new Date();
  const timestamp=now.toISOString().replace(/\.\d{3}Z$/,"Z");
  const sigTimestamp=[
    now.getUTCFullYear(),
    String(now.getUTCMonth()+1).padStart(2,"0"),
    String(now.getUTCDate()).padStart(2,"0"),
    String(now.getUTCHours()).padStart(2,"0"),
    String(now.getUTCMinutes()).padStart(2,"0"),
    String(now.getUTCSeconds()).padStart(2,"0"),
  ].join("");
  const requestId=("RID"+randomBytes(10).toString("hex")).slice(0,30).toUpperCase();
  const passwordHash=upperHash("sha512",auth.password.trim());
  const requestSignature=upperHash("sha3-512",requestId+sigTimestamp+auth.signKey.trim());
  return {timestamp,requestId,passwordHash,requestSignature};
}

function baseXml(auth:NavAuth){
  const ctx=requestContext(auth);
  const tax=auth.taxNumber.replace(/\D/g,"").slice(0,8);
  return {
    ctx,
    header:`<common:header>
      <common:requestId>${ctx.requestId}</common:requestId>
      <common:timestamp>${ctx.timestamp}</common:timestamp>
      <common:requestVersion>3.0</common:requestVersion>
      <common:headerVersion>1.0</common:headerVersion>
    </common:header>
    <common:user>
      <common:login>${xml(auth.login.trim())}</common:login>
      <common:passwordHash cryptoType="SHA-512">${ctx.passwordHash}</common:passwordHash>
      <common:taxNumber>${xml(tax)}</common:taxNumber>
      <common:requestSignature cryptoType="SHA3-512">${ctx.requestSignature}</common:requestSignature>
    </common:user>
    <software>
      <softwareId>SZKZPONT2026APP001</softwareId>
      <softwareName>Szemelyes Kozpont</softwareName>
      <softwareOperation>ONLINE_SERVICE</softwareOperation>
      <softwareMainVersion>1.0</softwareMainVersion>
      <softwareDevName>Szemelyes Kozpont</softwareDevName>
      <softwareDevContact>local@szemelyes-kozpont.vercel.app</softwareDevContact>
      <softwareDevCountryCode>HU</softwareDevCountryCode>
    </software>`
  };
}

function asArray<T>(value:T|T[]|undefined|null):T[]{
  if(value==null) return [];
  return Array.isArray(value)?value:[value];
}

function num(value:unknown):number|null{
  if(value===null||value===undefined||value==="") return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function str(value:unknown):string|null{
  if(value===null||value===undefined||value==="") return null;
  return String(value);
}

function navError(root:any){
  const code=str(root?.funcCode);
  if(code!=="ERROR") return null;
  const notes=asArray(root?.notifications?.notification);
  const text=notes.map((n:any)=>[n?.errorCode,n?.message,n?.info].filter(Boolean).join(" · ")).filter(Boolean).join(" | ");
  return text||"A NAV API hibát adott vissza.";
}

async function post(endpoint:string,body:string){
  const res=await fetch(API+endpoint,{
    method:"POST",
    headers:{
      "content-type":"application/xml;charset=UTF-8",
      "accept":"application/xml",
    },
    body,
    cache:"no-store",
  });
  const text=await res.text();
  if(!res.ok) throw new Error(`NAV HTTP ${res.status}: ${text.slice(0,240)}`);
  return parser.parse(text);
}

export async function queryIssuedInvoiceDigestPage(
  auth:NavAuth,
  dateFrom:string,
  dateTo:string,
  page:number
){
  const {header}=baseXml(auth);
  const body=`<?xml version="1.0" encoding="UTF-8"?>
  <QueryInvoiceDigestRequest xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common" xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
    ${header}
    <page>${page}</page>
    <invoiceDirection>OUTBOUND</invoiceDirection>
    <invoiceQueryParams>
      <mandatoryQueryParams>
        <invoiceIssueDate>
          <dateFrom>${xml(dateFrom)}</dateFrom>
          <dateTo>${xml(dateTo)}</dateTo>
        </invoiceIssueDate>
      </mandatoryQueryParams>
    </invoiceQueryParams>
  </QueryInvoiceDigestRequest>`;

  const parsed=await post("/queryInvoiceDigest",body);
  const root=parsed?.QueryInvoiceDigestResponse;
  const err=navError(root);
  if(err) throw new Error(err);
  const result=root?.invoiceDigestResult??{};
  const digests=asArray<any>(result.invoiceDigest).map((d:any):NavInvoiceDigest=>({
    invoiceNumber:String(d.invoiceNumber??""),
    batchIndex:num(d.batchIndex),
    invoiceOperation:String(d.invoiceOperation??"CREATE"),
    invoiceCategory:str(d.invoiceCategory),
    invoiceIssueDate:String(d.invoiceIssueDate??dateFrom),
    supplierTaxNumber:str(d.supplierTaxNumber),
    supplierName:str(d.supplierName),
    customerTaxNumber:str(d.customerTaxNumber),
    customerName:str(d.customerName),
    paymentMethod:str(d.paymentMethod),
    paymentDate:str(d.paymentDate),
    invoiceDelivery:str(d.invoiceDelivery),
    invoiceAppearance:str(d.invoiceAppearance),
    source:str(d.source),
    currency:String(d.currency??"HUF"),
    invoiceNetAmount:num(d.invoiceNetAmount),
    invoiceNetAmountHUF:num(d.invoiceNetAmountHUF),
    invoiceVatAmount:num(d.invoiceVatAmount),
    invoiceVatAmountHUF:num(d.invoiceVatAmountHUF),
    transactionId:str(d.transactionId),
    index:num(d.index),
    originalInvoiceNumber:str(d.originalInvoiceNumber),
    raw:d,
  })).filter((d:NavInvoiceDigest)=>d.invoiceNumber);

  return {
    currentPage:Number(result.currentPage??page),
    availablePage:Number(result.availablePage??page),
    digests,
  };
}

export async function queryIssuedInvoiceDigests(auth:NavAuth,dateFrom:string,dateTo:string){
  const first=await queryIssuedInvoiceDigestPage(auth,dateFrom,dateTo,1);
  const all=[...first.digests];
  for(let page=2;page<=first.availablePage;page++){
    const next=await queryIssuedInvoiceDigestPage(auth,dateFrom,dateTo,page);
    all.push(...next.digests);
  }
  return all;
}
