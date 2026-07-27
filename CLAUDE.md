@AGENTS.md

# Ship every finished feature

When a feature is done, deploy it — don't leave it sitting in the working
tree. Deploying means `git commit` + `git push origin main`: a GitHub webhook
runs `git reset --hard origin/main` + `npm install` + `npm run build` +
`systemctl restart ismytripsafe` on this box. Watch
`/var/log/ismytripsafe-deploy.log` for `deploy OK, service restarted`, then
curl the live URLs to confirm.

Two consequences of that `reset --hard`:

- **Anything uncommitted is destroyed on the next deploy** — anyone's, not
  just yours. Run `git status` before pushing and commit what's there.
- **Production is the `.next` in this directory**, served by systemd. Never run
  `next dev` here; it writes into that same `.next` and breaks the live site.
  To preview, copy the tree out first (`rsync -a --exclude .next --exclude
  node_modules --exclude .git . <scratch>/preview/`, then `cp -al node_modules
  <scratch>/preview/node_modules` — a symlink is rejected by Turbopack) and run
  `npx next dev -p 3005 -H 127.0.0.1` there. Ports 3000 and 3001 are taken.
