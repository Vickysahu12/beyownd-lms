// Per test file: start an in-memory MongoDB, connect, wipe Mongo + Redis
// before every test so tests never depend on each other, clean up at the end.
import os from 'os';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { redisClient } from '../../src/config/redis';
import { closeQueues } from '../../src/jobs/queue';

// Replica set (1 node), not a standalone server - payments use MongoDB
// transactions, which only work on a replica set (Atlas always is one)
let mongo: MongoMemoryReplSet;

// SAFETY: beforeEach wipes data. Never let that run against anything except
// a local server (e.g. the Atlas URI from .env).
const assertLocal = (uri: string | undefined, name: string) => {
  if (!uri || !/^(mongodb|redis):\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) {
    throw new Error(`Refusing to run tests: ${name} is not local (${uri ? 'remote URI' : 'missing'})`);
  }
};

// Fail fast with a clear message instead of hundreds of retry errors
const assertRedisUp = async () => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), 3000);
  });
  try {
    await Promise.race([redisClient.ping(), timeout]);
  } catch {
    throw new Error('Redis is not running. Start it with: docker start beyownd-redis');
  } finally {
    // An uncleared timer kept Jest alive after the last file ("did not exit")
    clearTimeout(timer);
  }
};

beforeAll(async () => {
  assertLocal(process.env.REDIS_URL, 'REDIS_URL');
  await assertRedisUp();
  // Data files go inside the project (.tmp/, gitignored), not the OS temp
  // folder: the system drive on the dev machine is nearly full, and MongoDB
  // refuses to start a replica set with < 500 MB free. Removed on teardown.
  const dbPath = path.join(__dirname, '..', '..', '.tmp', 'mongo-tests', `${process.pid}-${Date.now()}`);
  fs.mkdirSync(dbPath, { recursive: true });
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ dbPath }],
  });
  const uri = mongo.getUri('beyownd-test');
  assertLocal(uri, 'test MongoDB');
  // MongoDB driver 7 loads 'os' via dynamic import(), which Jest's vm sandbox
  // rejects - the handshake then fails with "Missing required sub-document
  // 'driver'". Handing the driver Node's os module directly avoids it.
  // Test-only: production Node supports dynamic import() normally.
  await mongoose.connect(uri, { runtimeAdapters: { os } });
  // Unique indexes (email, googleId) must exist for duplicate tests
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
});

beforeEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
  await redisClient.flushdb();
});

afterAll(async () => {
  await closeQueues();
  await mongoose.disconnect();
  await mongo?.stop({ doCleanup: true, force: true });
  // quit() waits for a reply - if Redis never connected it would hang forever
  if (redisClient.status === 'ready') await redisClient.quit();
  else redisClient.disconnect();
});
