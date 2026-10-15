# Record your drives with Cloudflare

rivian-mcp on your computer answers questions about your Rivian as it is now, such as its battery level. It cannot remember where you drove, because it only runs while you use it.

For that, you can run a small copy of it in your own Cloudflare account. It stays connected to your Rivian, records every drive and charge, and lets Claude or ChatGPT answer questions like "Show my last drive" or "How far did I drive this month?"

This is optional. The local version keeps working without it.

This is unofficial. It is not affiliated with or endorsed by Rivian. It only reads data from Rivian. The one thing it sends is your sign-in.

## What you need

- A free [Cloudflare](https://dash.cloudflare.com/sign-up) account. Step 1 shows how to create it.
- A free [GitHub](https://github.com/signup) account. Cloudflare keeps your copy of the project there.
- Your Rivian email and password, and the phone or email that gets Rivian's one-time code.
- A [Claude](https://claude.ai) account, or ChatGPT with custom connectors (see [Connect ChatGPT](#connect-chatgpt)).

Plan on 15 minutes.

## Cost

Start with the free Cloudflare plan. Its limits for the part that stays connected to your Rivian (Durable Objects) are 100,000 requests and 13,000 GB-seconds per day ([Cloudflare pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). I have not measured how much of that this uses. If recording stops partway through a day, you hit a limit. Workers Paid starts at $5 per month.

## Step 1: Deploy

1. Select this button:

   [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zentered-studios/rivian-mcp)

2. Sign in to Cloudflare. No account yet? Select **Sign up**, enter your email and a password, and open the link in the verification email. Skip the offers to add a website.
3. Connect your GitHub account when asked.
4. Keep the suggested names, or pick your own.
5. Select **Create and deploy**.
6. Turn off preview builds: open **Workers & Pages**, then **rivian-mcp**, then **Settings**, then **Build**. Under **Branch control**, clear **Enable Preview Builds**. Your copy has one recorder, so a preview of another branch has nothing to do.

Cloudflare copies the project to your GitHub, creates the storage it needs, sets up the database and starts it. This takes a few minutes. When it is done, it shows your address:

```text
https://rivian-mcp.<your-name>.workers.dev
```

You can find it again in the Cloudflare dashboard: **Workers & Pages**, then **rivian-mcp**.

If the build fails, open the build log under **Deployments**.

## Step 2: Find your connector address

Add `/mcp` to the end of your address:

```text
https://rivian-mcp.<your-name>.workers.dev/mcp
```

To check it, open it in a browser. A blank page or `Unauthorized` means it runs. A Cloudflare error page means the deploy failed. Open **Workers & Pages**, then **rivian-mcp**, then **Deployments** to see why.

## Connect Claude

Works on claude.ai and in the Claude desktop and mobile apps. Custom connectors are available on Free (one connector), Pro, Max, Team and Enterprise ([Anthropic's guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-MCP)).

1. In Claude, open **Settings**, then **Connectors**.
2. Select **Add custom connector**.
3. Name it `Rivian` and paste your connector address. Leave the advanced settings empty.
4. Select **Add**, then **Connect**.
5. Your sign-in page opens. Enter your Rivian email and password. The first account that signs in becomes the owner of your copy. Connect right after you deploy.
6. Rivian sends a one-time code. Enter it on the next page.
7. You are back in Claude, and recording has started.

Try it: in a new chat, turn on the Rivian connector in the **+** menu and ask "Is the recorder running?" Drives show up after your next trip.

On Team and Enterprise plans, an owner adds the connector under **Organization settings**, then **Connectors**. Each member then selects **Connect**.

## Connect ChatGPT

I have not tested this. OpenAI's custom connectors are in beta, and which plans get them differs between sources. Check [OpenAI's help article](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta) first.

1. In ChatGPT, open **Settings**, then **Connectors**, then **Advanced settings**. Turn on **Developer mode**.
2. Select **Create**. Name it `Rivian` and paste your connector address.
3. Set authentication to **OAuth**. Leave client ID and client secret empty.
4. Sign in with your Rivian email, password and one-time code.

## What you can ask

- "Is the recorder running?"
- "List my drives this week."
- "Show my last drive." Claude shows a map, elevation and speed.
- "Show my stats for the last 30 days."
- "Show my charging sessions."
- Everything the local version answers: "What's my battery level?", "Is there a software update?"

## When Rivian signs you out

Rivian ends sign-ins after a while. When that happens, Claude says "Not signed in to Rivian". Open **Settings**, then **Connectors**, select the Rivian connector, and connect it again. You sign in once more, and recording continues.

## Update

Your copy lives in your GitHub account. It is not a fork, so GitHub shows no **Sync fork** for it. To get a newer version, pull the changes from <https://github.com/zentered-studios/rivian-mcp> into your copy:

```sh
git clone https://github.com/<your-github-name>/<your-copy>.git
cd <your-copy>
git pull https://github.com/zentered-studios/rivian-mcp.git main
git push
```

Cloudflare deploys every change to your copy by itself.

## Your data

- Everything stays in your Cloudflare account: drives in a D1 database, sign-in data in a KV store.
- Place names for drive starts and ends come from [Photon](https://photon.komoot.io) (komoot's OpenStreetMap geocoder). The Worker sends it the coordinate rounded to about 100 m, with no account or drive id, and caches the answer in D1 so each place is asked once. Labels stop at the neighborhood or city; no street or house number is stored or shown.
- Your Rivian password goes straight to Rivian and is not stored. The Worker keeps the session Rivian returns, the same way the Rivian app stays signed in.
- The first Rivian account that signs in owns your copy. After that, only its email can sign in. Sign-in attempts are limited to 10 per minute.
- Until you sign in, anyone who finds your address can claim your copy with their own Rivian account. Connect right after you deploy. To pin the owner up front, add a `RIVIAN_EMAIL` secret: **Settings**, then **Variables and Secrets**.
- Anyone who finds your address can try passwords for the owner's email, within that limit.

## Remove it

In the Cloudflare dashboard, open **Workers & Pages**, select **rivian-mcp**, then **Settings**, then **Delete**. Under **Storage & Databases**, delete the D1 database and the KV namespace whose names start with `rivian-mcp`. Remove the connector in Claude or ChatGPT. You can delete your copy on GitHub too.

## Set it up from a terminal instead

If you would rather not use GitHub or the browser, you need [Node.js 24](https://nodejs.org) or newer.

```sh
git clone https://github.com/zentered-studios/rivian-mcp.git
cd rivian-mcp
npm install
npx wrangler login
npm run deploy
```

`npm run deploy` creates the storage on the first run, deploys, and sets up the database. Answer `y` if it asks. To update later, run `git pull`, `npm install` and `npm run deploy` again.
