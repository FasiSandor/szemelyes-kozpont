import { S3Client } from "@aws-sdk/client-s3";

export const DOCUMENT_BUCKET="personal-documents";

export function storageClient(){
  const endpoint=process.env.AWS_ENDPOINT_URL_S3;
  const region=process.env.AWS_REGION;
  const accessKeyId=process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey=process.env.AWS_SECRET_ACCESS_KEY;

  if(!endpoint||!region||!accessKeyId||!secretAccessKey){
    throw new Error("STORAGE_NOT_CONFIGURED");
  }

  return new S3Client({
    endpoint,
    region,
    forcePathStyle:true,
    credentials:{accessKeyId,secretAccessKey},
  });
}
