# Requests from the frontend session to the backend session

The frontend session never edits `beyownd-backend/`. When it finds something the backend should change, it is written here. The backend session marks each item done.

| # | Date | Request | Why | Status |
| --- | --- | --- | --- | --- |
| R1 | Oct 23, 2026 | Add `--files` to the `dev` and `worker` scripts in `package.json`: `ts-node-dev --files --respawn src/server.ts` and `ts-node-dev --files --respawn src/worker.ts` | `npm run dev` fails with `TS2339: Property 'user' does not exist on type 'Request'` in `user.controller.ts`. The `req.user` augmentation lives in `src/types/express.d.ts`, which `tsc` picks up through `include`, but ts-node ignores `include` unless `--files` is passed. CI (`tsc`) passes, so it only breaks local dev. Verified: with `--files` the server compiles, connects to Redis and MongoDB and listens on 5000. | ✅ Oct 23 — `--files` added to `dev` and `worker` (a `"ts-node": { "files": true }` tsconfig guard was tried and does **not** work with ts-node-dev, so it wasn't kept). Verified with the real `npm run dev` / `npm run worker`: both boot, `/health/ready` ok, CORS preflight from `localhost:3000` allowed, `POST /auth/signup` reachable |
