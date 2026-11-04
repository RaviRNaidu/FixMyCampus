# FixMyCampus

A full-stack campus service desk for reporting a facilities or technology issue, assigning it to campus staff, and following its progress through a status timeline.

## Stack and architecture

- **Client:** React, Vite, React Router, Axios, responsive CSS
- **API:** Node.js, Express, Mongoose, Zod
- **Data:** MongoDB
- **Authentication:** JWT in an HttpOnly cookie, bcrypt password hashes, server-side role and ownership checks
- **Security:** Helmet, explicit credentialed CORS, JSON size limit, login/register rate limits

The browser calls the Express API under `/api/v1`. MongoDB is only accessed by the API. Public registration always creates a student; admin and staff accounts are created through the controlled seed command.

## Features

- Student registration, login, own issue list, issue submission and timeline detail
- Admin issue list, search/status filters, dashboard counts and staff assignment
- Staff queue and assigned issue status updates
- Status history records the actor, time and optional note
- Responsive landing page, role-aware dashboard navigation, loading, validation, empty and error states

## Requirements

- Node.js 20 or newer and npm
- MongoDB local instance or MongoDB Atlas connection string

## Local setup

1. Configure the API:

   ```powershell
   Copy-Item server/.env.example server/.env
   ```

   Set `MONGODB_URI`, `JWT_SECRET`, and demo seed credentials in `server/.env`. The `.env` file is ignored by Git. Use a unique, long random JWT secret.

2. Install dependencies from the repository root:

   ```powershell
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

3. Create demo roles (using the configured seed-only credentials):

   ```powershell
   npm run seed --prefix server
   ```

4. Start both applications:

   ```powershell
   npm run dev
   ```

   Client: <http://localhost:5173> · API health: <http://localhost:5000/health>

   To run separately, use `npm run dev --prefix server` and `npm run dev --prefix client` in two terminals. Optional client configuration is in `client/.env.example`; copy it to `client/.env` only when changing the API URL.

## Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `PORT` | server | API port (defaults to 5000; hosting platform port is respected) |
| `MONGODB_URI` | server | MongoDB connection string |
| `JWT_SECRET` | server | Signing key for seven-day access token |
| `CLIENT_URL` | server | Exact allowed client origin for CORS |
| `NODE_ENV` | server | Set to `production` to use secure cross-site cookies |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | seed | Local demo admin account |
| `SEED_STAFF_EMAIL`, `SEED_STAFF_PASSWORD` | seed | Local demo staff account |
| `VITE_API_BASE_URL` | client | API base URL, including `/api/v1` |

Do not use real student data or commit `.env` files. Use only fictional demo reports and credentials in presentations.

## Main API routes

All application routes are under `/api/v1` and use JSON with `{ success, data }` or `{ success: false, error }` responses.

| Method | Route | Access |
|---|---|---|
| POST | `/auth/register` | Public; always creates student |
| POST | `/auth/login` | Public, rate limited |
| POST | `/auth/logout` | Signed in |
| GET | `/auth/me` | Signed in |
| GET / POST | `/issues` | Role scoped list / student create |
| GET | `/issues/:id` | Owner, assigned staff, or admin |
| PATCH | `/issues/:id/assign` | Admin; active staff only |
| PATCH | `/issues/:id/status` | Assigned staff or admin; valid transitions only |
| GET | `/dashboard/summary` | Role scoped counts |
| GET | `/users/staff` | Admin |
| POST | `/users/staff` | Admin; creates a staff account with a hashed password |

Issue transitions: `Open → Assigned → In progress → Resolved`. Staff can only update issues assigned to them. Admin can view all issues and assign/reassign staff. Students only see their own reports.

## Demo walkthrough

1. Register a student and submit an issue, for example “Projector not working” in Building A, Room 204.
2. Sign in with the seeded admin account and assign the issue to the seeded staff member.
3. Sign in as staff, start work, then mark the issue resolved with progress notes.
4. Return to the student account to review the persisted timeline.

## Deployment

- **API (Render or another Node host):** Set `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `NODE_ENV=production`, and the platform-provided `PORT`. Build/start command: `npm install` in `server`, then `npm start`.
- **Client (Vercel):** Set `VITE_API_BASE_URL` to the deployed API URL ending in `/api/v1`; set the build root to `client` or configure the project build command as `npm run build --prefix client` and output directory `client/dist`.
- Set `CLIENT_URL` to the exact deployed frontend origin. Production cookies are HttpOnly, Secure, and SameSite=None for cross-origin deployments; use HTTPS on both services.
- Run the seed command in a controlled environment after setting seed-only credentials. Do not use the example values for a public deployment.

## Verification checklist

Run the role and workflow integration check with `npm run test:security --prefix server`. It requires `MONGODB_URI` and `JWT_SECRET` in `server/.env`; it creates a uniquely named temporary database for the run and drops that database when finished. It does not write to the configured application database.

- [ ] Student can register and a submitted role cannot elevate the account.
- [ ] Duplicate email and invalid login show safe, readable errors.
- [ ] Student issue persists across refresh and another student's issue is hidden.
- [ ] Admin can assign only an active staff account.
- [ ] Unassigned staff cannot read or update an issue.
- [ ] Only valid status transitions are saved with timeline actor and timestamp.
- [ ] Dashboard counts are calculated by the API from MongoDB.
- [ ] Verify the complete student → admin → staff → student flow against the deployment.

## Known limitations

- No email alerts, images, comments, realtime push, reopening or CSV export in this MVP.
- API uses a bearer token fallback for local API clients; the browser uses an HttpOnly cookie. JWTs are not revoked server-side at logout; the client cookie is cleared.
- The automated security integration check covers the role boundaries and the core issue workflow. Also verify responsive UI behavior and loading/error states before presenting or deploying.
