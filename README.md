# Folio Vault

Folio Vault is a multi-user document manager built with HTML/CSS/JavaScript, Express, MongoDB/Mongoose, JWT sessions, and private Amazon S3 object storage. It reuses the existing `Assets/logo.png` and the midnight-blue workspace design.

## Requirements

- Node.js 20.19 or newer and npm
- MongoDB 7+ (local or MongoDB Atlas)
- A private S3 bucket and AWS credentials (use an IAM role in deployed environments)
- SMTP connection details to deliver password reset messages

## Local setup

1. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI`, `JWT_SECRET`, `AWS_REGION`, and `AWS_S3_BUCKET`. Use a random JWT secret of at least 32 characters. The server has no local database or file-storage fallback.
2. Create an S3 bucket with **Block Public Access** enabled. Give the app's IAM identity only the S3 permissions it needs on that bucket: `PutObject`, `GetObject`, and `DeleteObject`. The app sets server-side encryption on uploaded objects.
3. In PowerShell, run:

```powershell
cd backend
npm install
npm start
```

Open [http://localhost:5000](http://localhost:5000), create an account, and upload a supported file. Set `SMTP_URL`, `SMTP_FROM`, and `APP_BASE_URL` to enable password reset delivery.

## Deploy with GitHub, Vercel, and MongoDB Atlas

The repository includes a Vercel serverless entry at `api/[...path].js` and a root `package.json` so Vercel installs the backend dependencies. The local Express start command remains available from `backend/`.

1. Create a MongoDB Atlas cluster and a database user. Copy the application's `mongodb+srv://` connection string and replace its database username, password, and database name. URL-encode special characters in the username or password. Add the Vercel deployment's network access to the Atlas project before testing. Atlas IP access lists restrict database connections; `0.0.0.0/0` opens network reachability from anywhere, so use it only if you accept that exposure and keep a strong, least-privilege database user.
2. Create a private S3 bucket with Block Public Access enabled and an IAM identity limited to that bucket. The runtime needs S3 `PutObject`, `GetObject`, and `DeleteObject` permissions. Vercel does not provide an AWS instance role by default, so use Vercel encrypted environment variables for `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, or use a supported AWS federation setup. Never commit these values.
3. Push this project to a GitHub repository. In Vercel, choose **Add New → Project**, import that repository, and leave the project root at the repository root. No frontend build command is required.
4. In Vercel **Settings → Environment Variables**, add `MONGODB_URI`, `JWT_SECRET` (a random value with at least 32 characters), `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `COOKIE_SECURE=true`, `NODE_ENV=production`, `TRUST_PROXY=1`, `MAX_FILE_SIZE_MB=4`, `APP_BASE_URL` (the Vercel URL), `SMTP_URL`, and `SMTP_FROM`. Add them to Production and Preview only as appropriate, then redeploy after saving them.
5. Open the deployed site, register an account, and verify `/api/health`. Promote the first administrator from a trusted terminal with the same `MONGODB_URI`: `cd backend; npm install; node scripts/promoteAdmin.js account@example.com`. Configure `MONGODB_URI` in `backend/.env` for that command, and remove the local secret file afterwards.
6. After attaching a custom domain, update `APP_BASE_URL` to its HTTPS URL and redeploy. Test registration, login/logout, upload, preview, sharing, account recovery email, and admin access with separate test accounts before using real documents.

**Vercel upload limit:** the current upload route sends file bytes through a Vercel Function. Vercel documents a 4.5 MB request/response payload limit by default, while a newer 20 MiB option is a public beta. The Vercel environment value above sets a 4 MB per-file application limit to leave room for multipart overhead. The larger 100 MB limit remains suitable for a long-running host, but does not bypass Vercel's platform limit. Large-file support on Vercel needs a direct-to-S3 presigned upload flow, which is not implemented in this project.

The function adapter caches a MongoDB connection per warm serverless instance, but Atlas/S3 setup and deployed end-to-end behavior still need to be verified in the owner's accounts. Vercel's default serverless deployments do not make the app's process-local rate-limit counter a shared multi-instance limit; use a shared store for production scale.

## Make the first administrator

Register the administrator account through the app, then promote it from the backend after configuring `MONGODB_URI`:

```powershell
cd backend
node scripts/promoteAdmin.js account@example.com
```

This command changes that account's role in MongoDB and invalidates its current sessions. Registration never accepts a role from the browser. Admin routes are checked server-side.

## Implemented features

- User registration/login/logout, bcrypt password hashes, expiring JWT cookies, account profile, single-use password reset links, and suspended-account enforcement.
- MongoDB models for users, documents, folders, document versions, shares, reports, password reset tokens, and audit logs.
- Private S3 uploads for one or multiple files, per-user storage quotas, server-side size and file-signature checks, authorized preview/download/print, replacement version history, recycle/restore/permanent delete, search, sorting, favorites, categories, and folder moves.
- PDF.js preview with page navigation and zoom. Images and text preview in-browser. Word and spreadsheet files remain downloadable originals.
- Explicit document shares with view-only or download permission. Admin users see aggregate statistics, user account status, reports, and audit records. Admin endpoints do not grant private document access.
- Rate limiting, Helmet security headers, HttpOnly SameSite cookies, server-side owner checks, and private object keys.

## Cloud configuration and deployment

- Store production secrets in your host's secret manager. Do not commit `backend/.env` or AWS keys.
- Use MongoDB Atlas or a private MongoDB deployment with TLS and backups. The app creates its Mongoose indexes at startup in development and explicitly ensures model indexes in production.
- Keep the S3 bucket private. Use an instance/task IAM role instead of long-lived AWS keys when possible. Configure bucket lifecycle, versioning, retention, and backup to match your recovery requirements.
- Set `NODE_ENV=production`, `COOKIE_SECURE=true`, `APP_BASE_URL` to the HTTPS site URL, `MONGODB_URI`, `AWS_REGION`, `AWS_S3_BUCKET`, `JWT_SECRET`, and SMTP variables. Configure `TRUST_PROXY` only for the known number of trusted proxy hops.
- The included rate limiter uses an in-memory store. Use a shared rate-limit store such as Redis when running multiple server instances.
- Use a process manager/container and TLS reverse proxy. Set CORS only if deploying a separate frontend origin; the included app is same-origin and intentionally does not enable cross-origin credentials.

## Verification

Run `npm run check` and `npm test` from `backend/`. The isolation tests check the owner/shared query policy for multiple account IDs and confirm an administrator role alone does not grant file access.

Cloud integration and browser workflows require configured MongoDB, AWS S3, SMTP, and installed dependencies. They have not been exercised in this workspace. Do not treat account recovery email delivery, cloud persistence, or end-to-end isolation as verified until those configured flows are tested in your deployment environment.

## Compatibility routes

`login.html`, `register.html`, `document.html`, `upload.html`, and `view.html` forward users into the current authentication/dashboard flows.
