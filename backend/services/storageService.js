const fs = require('fs');
const { pipeline } = require('stream/promises');
const mongoose = require('mongoose');

// GridFS keeps file data in the same private Atlas database as document metadata.
// Leave most of the Atlas M0 quota for indexes, users, and application records.
const bucketName = process.env.ATLAS_GRIDFS_BUCKET || 'folioFiles';
const ledgerName = 'folioStorageCapacity';
const maxBytes = Math.max(1, Number(process.env.ATLAS_FILE_STORAGE_LIMIT_MB || 250)) * 1024 * 1024;

function database() {
  const db = mongoose.connection.db;
  if (!db) throw Object.assign(new Error('Database is not connected.'), { status: 503 });
  return db;
}

function bucket() { return new mongoose.mongo.GridFSBucket(database(), { bucketName }); }

async function ledger() {
  const db = database();
  const collection = db.collection(ledgerName);
  let record = await collection.findOne({ _id: bucketName });
  if (record) return collection;

  // Seed once from files already present (including files uploaded before a restart).
  const [usage] = await db.collection(`${bucketName}.files`).aggregate([
    { $group: { _id: null, bytes: { $sum: '$length' } } }
  ]).toArray();
  try {
    await collection.updateOne(
      { _id: bucketName },
      { $setOnInsert: { used: usage?.bytes || 0, limit: maxBytes } },
      { upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return collection;
}

async function reserve(bytes) {
  const collection = await ledger();
  const result = await collection.findOneAndUpdate(
    { _id: bucketName, $expr: { $lte: [{ $add: ['$used', bytes] }, '$limit'] } },
    { $inc: { used: bytes }, $set: { limit: maxBytes } },
    { returnDocument: 'after' }
  );
  if (!result) {
    throw Object.assign(new Error('Atlas file storage is full. Delete old files or lower the upload size.'), { status: 413 });
  }
}

async function release(bytes) {
  if (bytes > 0) await (await ledger()).updateOne({ _id: bucketName }, { $inc: { used: -bytes } });
}

async function putFile(file, key, contentType) {
  await reserve(file.size);
  const store = bucket();
  const upload = store.openUploadStream(key, { metadata: { contentType } });
  try {
    await pipeline(fs.createReadStream(file.path), upload);
  } catch (error) {
    const partial = await database().collection(`${bucketName}.files`).findOne({ _id: upload.id }).catch(() => null);
    if (partial) await store.delete(upload.id).catch(() => {});
    await release(file.size).catch(() => {});
    throw error;
  }
}

async function getFile(key) {
  const files = database().collection(`${bucketName}.files`);
  const file = await files.findOne({ filename: key });
  if (!file) throw Object.assign(new Error('File not found.'), { status: 404 });
  return {
    Body: bucket().openDownloadStream(file._id),
    ContentLength: file.length,
    ContentType: file.metadata?.contentType || 'application/octet-stream'
  };
}

async function deleteFile(key) {
  const files = database().collection(`${bucketName}.files`);
  const file = await files.findOne({ filename: key });
  if (!file) return;
  await bucket().delete(file._id);
  await release(file.length);
}

module.exports = { putFile, getFile, deleteFile };
