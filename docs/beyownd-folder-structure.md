# Beyownd — Backend Folder Structure & Request Flow

This is a **layered architecture** — the same pattern used at most companies for Node.js backends. The core idea: each folder has exactly **one job**, and a request flows through them in a fixed order. This is what "scalable" actually means at the code-organization level — not about handling more users, but about a codebase that stays understandable when it's 10x bigger and 3 people are working on it.

---

## The folder tree

```
beyownd-backend/
├── src/
│   ├── config/
│   │   ├── db.js              # Mongo connection setup
│   │   ├── redis.js           # Redis client setup
│   │   └── env.js             # loads & validates environment variables
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Course.js
│   │   ├── Module.js
│   │   ├── Enrollment.js
│   │   ├── Submission.js
│   │   └── Certificate.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── course.routes.js
│   │   ├── enrollment.routes.js
│   │   ├── submission.routes.js
│   │   ├── certificate.routes.js
│   │   └── index.js           # combines all routes into one router
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── course.controller.js
│   │   ├── enrollment.controller.js
│   │   ├── submission.controller.js
│   │   └── certificate.controller.js
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── course.service.js
│   │   ├── grading.service.js
│   │   ├── leaderboard.service.js
│   │   └── certificate.service.js
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.js       # verifies JWT, attaches req.user
│   │   ├── role.middleware.js       # checks admin vs student
│   │   ├── rateLimiter.middleware.js
│   │   └── errorHandler.middleware.js
│   │
│   ├── jobs/
│   │   ├── certificate.worker.js    # BullMQ worker: generates PDF
│   │   └── email.worker.js          # BullMQ worker: sends emails
│   │
│   ├── utils/
│   │   ├── generateToken.js
│   │   ├── hashPassword.js
│   │   └── apiResponse.js           # standard success/error response shape
│   │
│   ├── validators/
│   │   ├── auth.validator.js        # request body validation schemas
│   │   └── course.validator.js
│   │
│   ├── app.js                  # Express app setup (middleware, routes mounted)
│   └── server.js               # entry point — starts the HTTP server
│
├── tests/
│   ├── auth.test.js
│   └── course.test.js
│
├── .env
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## What each layer's job is — and why it's separate

**`routes/`** — the *address book*. A route file only says "this URL, with this HTTP method, goes to this controller function." No logic here, ever.

```js
// course.routes.js
router.get('/courses/:id', authMiddleware, courseController.getCourseById);
```

**`controllers/`** — the *receptionist*. Takes the incoming request, pulls out what it needs (params, body, the logged-in user), calls the right service to do the actual work, and sends back a response. A controller should **never** contain business logic or direct database queries — if you find yourself writing `Course.find(...)` inside a controller, it belongs in a service instead.

```js
// course.controller.js
exports.getCourseById = async (req, res) => {
  const course = await courseService.getCourseWithProgress(req.params.id, req.user.id);
  res.json(apiResponse.success(course));
};
```

**`services/`** — this is where the *actual business logic* lives. "Can this student access module 3?" "How many points does this quiz submission earn?" "Generate a certificate." This layer talks to models to read/write data, and can call other services (e.g., `certificate.service.js` might call `leaderboard.service.js` to award bonus points on completion).

```js
// course.service.js
exports.getCourseWithProgress = async (courseId, userId) => {
  const course = await Course.findById(courseId).populate('modules');
  const enrollment = await Enrollment.findOne({ userId, courseId });
  return mergeProgress(course, enrollment);
};
```

**`models/`** — the *shape of your data* (Mongoose schemas) and the direct interface to MongoDB. Only models talk to the database directly.

**`middlewares/`** — code that runs **before** a request reaches your controller. Auth check, role check, rate limiting. Think of these as security guards standing in the hallway before you reach the receptionist.

**`jobs/`** — separate background workers (remember the BullMQ pattern from the system design doc). These don't run as part of a normal request/response — they listen to a queue and process things asynchronously (generating a certificate PDF, sending an email).

**`utils/` and `validators/`** — small reusable helpers. Utils = generic helper functions. Validators = rules for "is this signup request body actually valid" before it even reaches a controller.

**`app.js` vs `server.js`** — a subtle but important separation: `app.js` builds the Express app (registers middleware, mounts routes) but doesn't start listening on a port. `server.js` imports that app and actually starts it. Why split them? Because your **tests** can import `app.js` directly and simulate requests without needing a real running server on a real port — this is standard practice, not overkill.

---

## The full request lifecycle — walked through end to end

Let's trace: *"A student submits a quiz answer."*

```
1. POST /api/submissions  →  hits routes/submission.routes.js
2. Route runs authMiddleware first → verifies JWT, attaches req.user
3. Route runs the validator → checks the request body is well-formed
4. Passes to controllers/submission.controller.js → createSubmission()
5. Controller calls services/grading.service.js → gradeSubmission()
6. Service checks the answer against the correct one (from models/Submission.js's related quiz data)
7. Service calls services/leaderboard.service.js → awards points, updates Redis sorted set
8. Service saves the graded submission via models/Submission.js
9. If this submission completes the course, service triggers jobs/certificate.worker.js
   by adding a job to the BullMQ queue (doesn't wait for it — fires and continues)
10. Controller sends the response back to the student immediately: "Submitted! Score: 8/10"
11. Meanwhile, separately, the certificate worker picks up the queued job,
    generates the PDF, saves it, and (optionally) triggers an email job
```

Notice: steps 1-10 happen fast, synchronously, as one request/response cycle. Step 11 happens **independently, in the background** — this is exactly the job-queue pattern from the system design doc, now shown at the actual code level.

---

## Why this structure scales (the part that matters for your interview story)

- **Adding a new feature** (say, a "discussion comments" feature later) means adding one new route file, one controller, one service, one model — you're not hunting through a tangled mess of one giant `server.js` file.
- **Testing is isolated** — you can test `grading.service.js`'s logic directly without spinning up routes or a real HTTP server.
- **Multiple people can work without collisions** — one person on `auth`, another on `certificate`, rarely touching the same file.
- **This is the same shape as controller-service-repository patterns used at most companies** — when you join a real engineering team, this folder structure will look immediately familiar, not like a fresh concept.

## One naming convention to lock now (so it doesn't get inconsistent later)

`<domain>.<layer>.js` — e.g. `course.controller.js`, `course.service.js`, `course.routes.js`. This means anyone (including future-you) can instantly tell what a file does and which domain it belongs to just from its name, even in a big file tree.

---

## Frontend (Next.js) — brief note, we'll go deep on this when you get there

Mirror the same instinct: `app/` (routes/pages), `components/`, `lib/` (API calls, utilities), `hooks/`, `store/` (if using state management). Same principle — one job per folder. We'll design this properly once backend is further along, so it's not competing for your attention right now.

---

**Next up:** with this structure locked, the natural next step is finalizing the exact Mongoose schemas field-by-field (what goes in `models/`) and the full API route list (what goes in `routes/`). Want to do that next, or do you have another concept you want clarified first?


BeyowndClassroom/
├── docs/
│   └── ...same as above
│
├── beyownd-backend/
│   ├── src/...
│   ├── tests/
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   ├── Dockerfile          ← stays (backend's own image recipe)
│   └── package.json
│
├── beyownd-frontend/
│   ├── app/                ← Next.js routes/pages
│   ├── components/
│   ├── lib/                ← API calls, utilities
│   ├── hooks/
│   ├── .env.local
│   ├── Dockerfile          ← frontend's own image recipe
│   └── package.json
│
├── docker-compose.yml       ← MOVES to repo root — orchestrates both services together
└── README.md