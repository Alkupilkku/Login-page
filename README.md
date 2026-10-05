# Login Page

Run the app locally with `npm start`.

Netlify builds this project with `npm run build`, which copies only `index.html`, `styles.css`, and `script.js` into `dist/`. The Netlify CLI deploy command also runs the build before publishing:

```sh
npx --yes netlify-cli login
npx --yes netlify-cli link
npm run deploy
```

Link an existing Netlify site first. To create a site instead, use `npx --yes netlify-cli init --manual`. Netlify needs to be authenticated and linked before `npm run deploy` can publish.

This deploy serves static files only. It does not include or run the Node/SQLite backend in `server.js`, so authentication will not work until that backend is separately adapted and hosted.
