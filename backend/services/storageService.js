const fs = require('fs');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const bucket = process.env.AWS_S3_BUCKET;
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
function ensureConfigured() { if (!bucket) throw Object.assign(new Error('Cloud file storage is not configured. Set AWS_S3_BUCKET.'), { status: 503 }); }
async function putFile(file, key, contentType) { ensureConfigured(); await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fs.createReadStream(file.path), ContentLength: file.size, ContentType: contentType, ServerSideEncryption: 'AES256' })); }
async function getFile(key) { ensureConfigured(); return s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })); }
async function deleteFile(key) { ensureConfigured(); await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); }
module.exports = { putFile, getFile, deleteFile };
