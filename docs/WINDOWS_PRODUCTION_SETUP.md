# IMPOC — Production setup on a Windows laptop

This is the shop laptop guide. No dev servers: the backend runs under **pm2**
and serves the **built** frontend on one port (`http://<laptop-ip>:3000`).
Everything starts by itself when the laptop boots and signs in.

Scripts live in [`deploy/windows/`](../deploy/windows/):

| File | What it does |
|---|---|
| `setup.cmd` / `setup.ps1` | One-time install. Right-click → *Run as administrator*. Safe to re-run. |
| `update.cmd` / `update.ps1` | Pull from GitHub, install, migrate, rebuild, restart. Double-click whenever there is a new version. |
| `start.cmd` / `start.ps1` | Brings everything up: PostgreSQL → pm2 → opens the app in a browser window. Runs at every login (setup puts a shortcut in the Startup folder). Double-click it if the app ever looks down. `start.cmd --no-browser` starts the services only. |

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

In `C:\impoc\deploy\windows`, right-click **`setup.cmd`** → **Run as administrator**.
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

Daily `pg_dump` via Task Scheduler. Create `C:\impoc-backups`, then a Basic Task, daily at closing time, action *Start a program*:

- Program: `C:\Program Files\PostgreSQL\16\bin\pg_dump.exe` (adjust version)
- Arguments: `-U postgres -Fc -f C:\impoc-backups\impoc-%date:~-4%%date:~-7,2%%date:~-10,2%.dump impoc`
- Set a `PGPASSWORD` environment variable for that user, or add a `%APPDATA%\postgresql\pgpass.conf` line: `localhost:5432:impoc:postgres:<password>`

Copy the folder to a USB stick or cloud drive weekly. Restore with `pg_restore -U postgres -d impoc -c <file>.dump`.

## 9. Known limits

- **Phone-camera barcode scanning needs HTTPS.** Browsers allow the camera only on `https://` or `localhost`. Scanning **on the laptop** works; scanning **from a phone** over `http://192.168.1.10:3000` does not. The customer display / UPI QR on a tablet is fine (no camera). If phone scanning is needed, add Caddy as an HTTPS reverse proxy with its internal CA and install its root certificate on each phone — ask for that setup.
- `package-lock.json` is not tracked in git, so `npm install` resolves versions at install time. Track the lockfiles if you want bit-identical installs.
- `backend\.env` holds the DB password and JWT secrets. Never commit it; back it up somewhere private.
- `setup.ps1` never overwrites an existing `backend\.env` (it only refreshes `FRONTEND_ORIGIN`). Delete the file and re-run to regenerate it.
