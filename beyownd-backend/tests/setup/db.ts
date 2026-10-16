// Per test file: start an in-memory MongoDB, connect, wipe Mongo + Redis
// before every test so tests never depend on each other, clean up at the end.
import os from 'os';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { redisClient } from '../../src/config/redis';

let mongo: MongoMemoryServer;

// SAFETY: beforeEach wipes data. Never let that run against anything except
// a local server (e.g. the Atlas URI from .env).
const assertLocal = (uri: string | undefined, name: string) => {
  if (!uri || !/^(mongodb|redis):\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) {
    throw new Error(`Refusing to run tests: ${name} is not local (${uri ? 'remote URI' : 'missing'})`);
  }
};

beforeAll(async () => {
  assertLocal(process.env.REDIS_URL, 'REDIS_URL');
  mongo = await MongoMemoryServer.create();
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
  await mongoose.disconnect();
  await mongo?.stop();
  await redisClient.quit();
});
