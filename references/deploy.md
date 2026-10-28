# Deploy: GitHub + Vercel

The standing request: "now create a repo named <site>-redesign in my git and push this, and from git push it to
vercel in the same name. use image optimization so that no large storage is going to affect the vercel.
while deploying, deploy it exactly how it is now. do not increase or decrease the size."

- GitHub account: `ajaymuthupandy` (signed in through `gh`).
- Vercel account: `vercel.com/ajaymuthupandy`. Don't use the old `anuragamurugan-4143` CLI login; the user had it removed.

## 1. Confirm the repo name
Use the name the user typed. Past names had typos (`himalayanbabji-`, `uluwatusrfvillas-`, `gaiaretrestcenter-`),
and once the wrong site's name was typed and then corrected. If the name doesn't match the site or folder
name, ask once before creating anything: repo and Vercel names are tedious to change later.

## 2. Optimise before the first commit
Vercel deployment storage grew to 804 MB (Spacious Yoga), 2.48 GB (AathiLife) and 6 GB for the account.
Every push stores a full copy, so keep the build small:
- Images: WebP (or AVIF), max 2560px wide for full-bleed heroes, 1600px for content images, quality 75–80.
  Logos as SVG or 2× PNG.
- Videos: H.264 MP4, hero loops ≤ 8 MB, with a WebP poster.
- Delete unused assets and duplicate copies. Keep downloaded originals out of git (`assets-original/` in `.gitignore`).
- `.gitignore` must cover `node_modules/`, `.next/`, `qa/`, `audit/`, screenshots, `*.log`, `.env*`.
- Check: `du -sh public` should be tens of MB, not hundreds. Report the before and after sizes.
- **File name case:** Windows ignores case, Vercel's Linux build doesn't. `Hero.JPG` referenced as `hero.jpg`
  works locally and breaks live. Search for mismatches before pushing.

## 3. Commit as Ajay
Vercel blocks deploys from commit authors it doesn't recognise (this happened on Spacious Yoga):
```bash
git config user.name "Ajay Muthupandy"
git config user.email "249107627+ajaymuthupandy@users.noreply.github.com"
git log -1 --format=%ae   # verify before every push
```
Set it per repo (no `--global`): the machine's global identity is a placeholder.

## 4. Create the repo (private by default)
```bash
gh repo create ajaymuthupandy/<name> --private --source . --remote origin --push
```
Most past redesign repos are private. Make one public only if the user says so.

## 5. Connect Vercel under the same name
- Preferred: a Git-connected Vercel project named `<name>`, production branch `main`, so every push to `main` deploys.
- With the CLI: `npx vercel@latest link --yes --project <name>`, then `npx vercel@latest git connect`, then
  push. Use `npx vercel@latest --prod` only when Git deploys aren't set up.
- If the CLI or MCP gets a 403 for the scope, check `npx vercel@latest whoami`. Deploy status can also be
  read from GitHub: `gh api repos/ajaymuthupandy/<name>/commits/<sha>/statuses`.
- A deploy in state BLOCKED usually means the commit author is wrong (step 3). Fix it and push a new commit.

## 6. Prove "exactly how it is now"
1. Before pushing, run the QA gate on a local production build (`npm run build && npm run start`) and keep `qa/report.json`.
2. After the deploy is READY, run the same check on the live URL with the same profile and viewports:
   ```bash
   node "<skill>/scripts/check-site.mjs" https://<name>.vercel.app --profile a-eweb.profile.json --out qa-live
   ```
3. Compare the two reports, and open the `bottom-*` screenshots side by side. Same pages, same results, same look.
   Common causes of drift: case-sensitive file names, files caught by `.gitignore`, fonts loaded from a local
   path that isn't committed, environment variables, and absolute `localhost` URLs.
4. Only then give the user the live link, saying it was verified.

## 7. Projects with auto-deploy
Some projects have a standing rule: every correction goes live without asking (Spacious Yoga, Surf n Yoga,
Radiantly Alive). Mark these with `"autoDeploy": true` in the profile. For them, every finished
correction ends with lint, build, the QA gate, commit, push to `main`, waiting for READY, and checking the
live URL. Never push a failing build.

## 8. Deleting deployments
"Delete the previous deployments of this project in Vercel" means that project only. List what will be
deleted and confirm before deleting. Never touch other projects. To redeploy "the current localhost version
in the same name", deploy from the current folder after the QA gate passes.
