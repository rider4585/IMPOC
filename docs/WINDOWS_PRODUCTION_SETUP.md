# IMPOC — Production setup on a Windows laptop

This is the shop laptop guide. No dev servers: the backend runs under **pm2**
and serves the **built** frontend on one port (`http://<laptop-ip>:3000`).
Everything starts by itself when the laptop boots and signs in.

Scripts live in [`deploy/windows/`](../deploy/windows/):

| File | What it does |
|---|---|
| `setup.cmd` / `setup.ps1` | One-time install. Double-click (automatically requests Administrator privileges via UAC). Safe to re-run. |
| `update.cmd` / `update.ps1` | Pull from GitHub, install, migrate, rebuild, restart. Double-click (automatically requests Administrator privileges via UAC). |
| `start.cmd` / `start.ps1` | Brings everything up: PostgreSQL → pm2 → opens the app in a browser window. Runs at every login or double-click (automatically requests Administrator privileges via UAC). `start.cmd --no-browser` starts the services only. |
| `setup-backup-local.cmd` / `setup-backup-local.ps1` | Set up / update the **local** backups only (automatically requests Administrator privileges). Ask for two times, default 14:00, 21:00. Safe to re-run. |
| `setup-backup-cloud.cmd` / `setup-backup-cloud.ps1` | Set up / update the **cloud** backups only (automatically requests Administrator privileges). Needs a one-time Google sign-in. Safe to re-run. |
| `restore-db.cmd` / `restore-db.ps1` | Restore database from backup (automatically requests Administrator privileges). Interactive dump picker + confirmation. |

---

## 1. Install these first (by hand)

| # | Software | Version | Notes |
|---|---|---|---|
| 1 | **Git for Windows** | latest | git-scm.com. Default options are fine. |
| 2 | **Node.js** | **20 LTS** (20.19+) | nodejs.org. Node 22 LTS also works. Tick "Automatically install the necessary tools" only if step 4 of setup fails on `argon2`. |
| 3 | **PostgreSQL** | 16 or 17 | postgresql.org/download/windows. In the installer: tick **Command Line Tools**; note the `postgres` password you choose; leave port **5432**. |
| 4 | **Chrome** or **Edge** | latest | Edge is already on Windows. The start script opens the app as an app-window. |

Not needed on this laptop: VS Code, Postman, a test database. pm2 is installed by the setup script.

## 2. Windows settings (5 minutes)

1. **Fixed IP.** On the router, reserve the laptop's IP (e.g. `192.168.1.10`). Staff and the customer-display tablet will use `http://192.168.1.10:3000`. If the IP changes, the URL changes.
2. **Network profile.** Settings → Network → Wi‑Fi → the shop network → set to **Private**. The firewall rule only opens on Private networks.
3. **Power.** Settings → System → Power: sleep **Never** when plugged in; lid close → **Do nothing**.
4. **Automatic sign-in.** Win+R → `netplwiz` → untick *Users must enter a user name and password* → enter the Windows password. Without this, nothing starts until someone logs in.
5. **Windows Update.** Set *Active hours* to shop hours so it doesn't reboot mid-day.

## 3. Get the code

Open **Git Bash** or PowerShell:

```bash
git clone https://github.com/rider4585/IMPOC.git C:\impoc
```

Keep the path short and without spaces (`C:\impoc`) — long paths inside `node_modules` cause trouble on Windows.

## 4. Run the setup script (once)

In `C:\impoc\deploy\windows`, double-click **`setup.cmd`** (it will ask for administrator privileges via the Windows UAC prompt and run elevated).
Run it as the **same Windows user** that will be signed in on the shop laptop (pm2 keeps its process list per user).

It asks for:

- the PostgreSQL `postgres` password,
- the address staff will type (it suggests the laptop's current IP),
- the admin login password to create, and the store name / address / phone (printed on receipts).

Then it does all of this on its own:

1. Checks Git, Node, PostgreSQL. Sets the PostgreSQL service to start automatically.
2. Creates the `impoc` database.
3. Writes `backend\.env` with **fresh random JWT secrets**, `NODE_ENV=production`, `COOKIE_SECURE=false` (needed for plain HTTP on the LAN), `FRONTEND_ORIGIN=<your URL>`.
4. `npm install` in `backend`, runs migrations, seeds roles/permissions/admin.
5. `npm install --legacy-peer-deps` + `npm run build` in `frontend` (uses `frontend/.env.production` → `VITE_API_BASE_URL=/api`). The backend serves `frontend/dist` itself.
6. Installs **pm2**, starts the `impoc` process from `backend/ecosystem.config.cjs`, `pm2 save`.
7. Opens Windows Firewall TCP 3000 (Private networks).
8. Puts an **IMPOC** shortcut to `start.cmd` in the Startup folder.
9. Creates `C:\IMPOC-backups`, registers the two daily **local** backup tasks and the every-logon **catch-up** task, and takes the first verified backup.
10. Installs rclone, signs in to Google Drive once, registers the two daily **cloud** backup tasks, and uploads the first encrypted copy (skip with `setup.ps1 -SkipCloud`).

When it finishes it prints the URLs and the login (`admin` / the password you typed).
**Change the admin password inside the app after first login.**

## 5. What happens on every boot

1. Windows signs in automatically (step 2.4).
2. The Startup shortcut runs `start.cmd`, which:
   - waits for the PostgreSQL service,
   - `pm2 resurrect` (restarts the saved `impoc` process; falls back to `pm2 start ecosystem.config.cjs`),
   - waits until `http://localhost:3000` answers,
   - opens the app in Chrome/Edge as a maximised app window.
3. A log of each start is written to `backend\logs\start.log`.

pm2 itself restarts the backend if it crashes (`autorestart`, 3 s delay, memory cap 500 MB). App logs: `backend\logs\impoc-out.log` and `impoc-error.log`, or `pm2 logs impoc`.

## 6. Day-to-day commands

Open PowerShell in `C:\impoc\backend`:

```bash
pm2 status
```
```bash
pm2 logs impoc
```
```bash
pm2 restart impoc
```

App not reachable? Double-click `deploy\windows\start.cmd`.

## 7. Updating the app

The repo is public, so the laptop pulls straight from GitHub with no login.
Double-click **`deploy\windows\update.cmd`** (no admin needed). It:

1. Refuses to run if tracked files were edited on the laptop (it must only follow GitHub).
2. `git pull --ff-only` on the current branch. Stops if nothing changed.
3. If migrations changed: `pg_dump` to `C:\impoc\backups\pre-update-<date>-<commit>.dump` first.
4. If `backend/` changed: `npm install`, `npm run db:migrate`.
5. If `frontend/` changed: `npm install --legacy-peer-deps`, build into `dist.new`, then swap it in. A failed build leaves the old site running.
6. `pm2 restart impoc` and waits until `http://localhost:3000` answers.

Every run is logged to `backend\logs\update.log`. Options: `update.ps1 -Branch main`, `-SkipBackup`.

## 8. Backups

Set up automatically by `setup.cmd` (steps 9–10). Everything lives in **`C:\IMPOC-backups\`** — outside the code folder, so updates never touch it.

Two kinds, both automatic and scheduled:

| | Local | Cloud |
|---|---|---|
| What | a `pg_dump` of the database on this laptop | an encrypted copy on the shop's Google Drive (via rclone) |
| When | 14:00 and 21:00 daily | 14:00 and 21:00 daily |
| Tasks | **IMPOC local backup 1 / 2** | **IMPOC cloud backup 1 / 2** |
| Retention | 14 days | 90 days |

### How a run works
Each scheduled task calls `backup-local.ps1` / `backup-cloud.ps1` with its slot time (`-SlotTime HH:mm`). A backup counts for a slot only when it finished **after** that slot (checked against `last-status.json`); if the slot is already covered, the run logs "skipped" and stops instead of making a duplicate. Every run appends to `logs\backup-YYYY-MM.log` and updates `C:\IMPOC-backups\last-status.json`.

- **Local:** `pg_dump` (compressed) → `local\impoc-YYYY-MM-DD_HHmm.dump`, verified with `pg_restore --list` (a bad dump is thrown away), old local dumps deleted after 14 days.
- **Cloud:** takes a fresh verified backup, uploads it with rclone to the **encrypted** remote `gdrive-crypt` as `IMPOC-backups / 2026 / 09 / 14 / impoc-2026-09-14_1830.dump` (date-wise folders, plus `backend\.env` under `config/`), confirms the file on the remote (`--checksum`), removes cloud copies older than 90 days.

### Missed a run (laptop was off)?
A 10‑minute per-kind lock (`local.lock` / `cloud.lock` in `C:\IMPOC-backups`) stops two runs from dumping at the same moment, and the **IMPOC backup catch-up** task runs **at every login**: it reads `last-status.json` and immediately re-runs any slot that has already passed without a backup. So if the laptop was off at 14:00 and 21:00, the first person to sign in triggers both backups right away. (If only the cloud part is not configured yet, it logs a warning and skips just the cloud; the local backup still runs.)

### Take a backup by hand
Double-click `deploy\windows\backup-local.cmd` (local) or `deploy\windows\backup-cloud.cmd` (cloud) any time — they ignore the slot logic and just run.

### Set up backups *without* re-running the full setup
Already ran `setup.cmd` once? To (re)configure the backups alone:

1. `deploy\windows\setup-backup-local.cmd` — asks the two times, registers the local tasks + the catch-up task, and takes the first verified backup.
2. `deploy\windows\setup-backup-cloud.cmd` — configures rclone + Google Drive (one-time sign-in), registers the cloud tasks, and uploads the first encrypted copy.

Both are idempotent and safe to re-run; they never touch the app.

### Change the times
Re-run `setup-backup-local.cmd` (asks, or `setup-backup-local.ps1 -BackupTimes '09:30,20:00'`) and then `setup-backup-cloud.cmd`. The full `setup.cmd`/`setup.ps1 -BackupTimes ...` does the same for both at once. The single source of truth for the slots is `deploy\windows\lib\backup-common.ps1` (`$script:BackupSlotTimes`, default `14:00,21:00`); the catch-up uses it too.

### Encryption
Cloud files are **encrypted on the laptop before upload** — Google only sees scrambled names and contents. The encryption password + salt were shown once during setup and written to `C:\IMPOC-backups\CLOUD-BACKUP-PASSWORD-SAVE-ME.txt`: **save them in your password manager and delete that file.** Without them the cloud backups cannot be read on another computer.

### Verify health
`C:\IMPOC-backups\last-status.json` shows the last local and cloud result and time; `logs\backup-YYYY-MM.log` lists every run.

**If the cloud upload starts failing with a token / login error** (Google logins expire every few months): open PowerShell and run `rclone config reconnect gdrive:` — sign in again, done.

### Restore
Double-click **`deploy\windows\restore-db.cmd`** (or run from PowerShell; both ask for Administrator privileges automatically via UAC):
```
.\deploy\windows\restore-db.ps1               # choose from local backups
.\deploy\windows\restore-db.ps1 -FromCloud    # list + download from Google Drive first
```
It shows the backups newest-first, asks you to type the database name to confirm, takes a safety copy of the current data, stops the app, restores, runs migrations and starts the app again. If a restore fails, the safety copy path is printed so you can go back.

### On a brand-new laptop
Install PostgreSQL, Node, Git, rclone; sign in to the same Google account (`rclone config create gdrive drive scope drive.file`); recreate the encrypted remote with the saved password + salt:
`rclone config create gdrive-crypt crypt remote gdrive:IMPOC-backups password <password> password2 <salt>`
then run `setup.cmd` and `restore-db.ps1 -FromCloud`.

## 9. Known limits

- **Phone-camera barcode scanning needs HTTPS.** Browsers allow the camera only on `https://` or `localhost`. Scanning **on the laptop** works; scanning **from a phone** over `http://192.168.1.10:3000` does not. The customer display / UPI QR on a tablet is fine (no camera). If phone scanning is needed, add Caddy as an HTTPS reverse proxy with its internal CA and install its root certificate on each phone — ask for that setup.
- `package-lock.json` is not tracked in git, so `npm install` resolves versions at install time. Track the lockfiles if you want bit-identical installs.
- `backend\.env` holds the DB password and JWT secrets. Never commit it; back it up somewhere private.
- `setup.ps1` never overwrites an existing `backend\.env` (it only refreshes `FRONTEND_ORIGIN`). Delete the file and re-run to regenerate it.
