import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const maxItems = 50;

function storage(): { client: S3Client; bucket: string } {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const username = process.env.ZERO_MINIO_ROOT_USER;
  const password = process.env.ZERO_MINIO_ROOT_PASSWORD;
  const bucket = process.env.ZERO_STORAGE_BUCKET;
  if (!endpoint?.startsWith("http://127.0.0.1:") || !username || !password || !bucket) {
    throw new Error("Storage local indisponível.");
  }
  return {
    bucket,
    client: new S3Client({
      endpoint,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: username, secretAccessKey: password },
    }),
  };
}

export async function putExample(file: File): Promise<{ key: string }> {
  if (!new Set(["image/png", "image/jpeg"]).has(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error("Arquivo inválido.");
  }
  const { bucket, client } = storage();
  const extension = file.type === "image/png" ? "png" : "jpg";
  const key = `examples/${crypto.randomUUID()}.${extension}`;
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from(await file.arrayBuffer()), ContentType: file.type }),
  );
  return { key };
}

export async function listExamples(): Promise<readonly string[]> {
  const { bucket, client } = storage();
  const output = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: "examples/", MaxKeys: maxItems }));
  return (output.Contents ?? []).flatMap((item) => (item.Key === undefined ? [] : [item.Key]));
}
