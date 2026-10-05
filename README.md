# Login Page

Run `npm install` once, then start the local Node/SQLite app with `npm start`.

Netlify builds this project with `npm run build`, which copies the HTML and CSS and bundles Netlify Identity authentication into `dist/script.js`. The Netlify CLI deploy command also runs the build before publishing:

```sh
npx --yes netlify-cli login
npx --yes netlify-cli link
npm run deploy
```

Link an existing Netlify site first. To create a site instead, use `npx --yes netlify-cli init --manual`. Netlify needs to be authenticated and linked before `npm run deploy` can publish.

Enable Identity for the linked site under **Project configuration → Identity** before signing up or logging in, and allow open registration if visitors should be able to create accounts. For the current site, use [Netlify Identity settings](https://app.netlify.com/projects/first-go-login-page/configuration/identity). New users must confirm their email unless autoconfirm is enabled. The app handles confirmation links; password recovery and invitation acceptance are not supported on this page.

Netlify serves the static frontend and uses Netlify Identity for its accounts. The local `npm start` server still uses its separate SQLite database in `users.db`; local accounts and Netlify accounts are not shared. The static deploy does not include or run `server.js`.
