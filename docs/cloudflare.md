# Record your drives with Cloudflare

Run the recorder in your Cloudflare account to keep drive and charging history. Ask Claude or ChatGPT, "Show my last drive" or "How far did I drive this month?"

The local version queries live vehicle data without recording it. You can keep using it without Cloudflare.

This project is unofficial and is not affiliated with or endorsed by Rivian. It reads vehicle data and sends authentication requests. It cannot send vehicle commands.

## What you need

- A free [Cloudflare](https://dash.cloudflare.com/sign-up) account. Step 1 shows how to create it.
- A free [GitHub](https://github.com/signup) account. Cloudflare keeps your copy of the project there.
- Your Rivian email and password, and the phone or email that gets Rivian's one-time code.
- A [Claude](https://claude.ai) account, ChatGPT or Codex. See [Connect Claude](#connect-claude), [Connect ChatGPT](#connect-chatgpt) and [Connect Codex](#connect-codex).

Plan on 15 minutes.

The screenshots come from a test account where the Worker is named `rivian-cloud`. Yours is `rivian-mcp`, so your address starts with `rivian-mcp`.

## Cost

Start with the free Cloudflare plan. Its limits for the recorder (a Durable Object) are 100,000 requests and 13,000 GB-seconds per day ([Cloudflare pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). I have not measured how much of that this uses. If recording stops, inspect `recorder_status` and the Worker logs: quota exhaustion, a lost connection or an expired Rivian session can all interrupt recording. Workers Paid starts at $5 per month.

## Step 1: Deploy

1. Select this button:

   [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zentered-studios/rivian-mcp)

2. Sign in to Cloudflare. No account yet? Select **Sign up**, enter your email and a password, and open the link in the verification email. Skip the offers to add a website.
3. Connect your GitHub account when asked.
4. On **Select a repository**, the project's address is under **Clone a public repository via Git URL**. If the field is empty, paste `https://github.com/zentered-studios/rivian-mcp`. Select **Next**.

   ![Cloudflare's Select a repository step with the rivian-mcp Git URL filled in](images/cloudflare-select-repository.png)

5. On **Create and deploy**, keep **Create private Git repository** checked, keep the project name `rivian-mcp` and leave the KV namespace on **Create new**. Select **Deploy**.

   ![Cloudflare's Create and deploy step with the project name rivian-mcp and a new KV namespace](images/cloudflare-create-and-deploy.png)

6. Turn off preview builds: open **Workers & Pages**, then **rivian-mcp**, then **Settings**, then **Build**. Under **Branch control**, clear **Enable Preview Builds**. This setup uses one production recorder.

Cloudflare copies the project to your GitHub, creates the storage it needs, sets up the database and starts it. This takes a few minutes. When it is done, it shows your address:

```text
https://rivian-mcp.<your-name>.workers.dev
```

Find the address under **Workers & Pages** > **rivian-mcp** > **Domains**.

![The Domains tab of the Worker in the Cloudflare dashboard, showing the production Worker URL](images/cloudflare-worker-url.png)

If the build fails, open the build log under **Deployments**.

## Step 2: Find your connector address

Add `/mcp` to the end of your address:

```text
https://rivian-mcp.<your-name>.workers.dev/mcp
```

To check it, open it in a browser. A blank page or `Unauthorized` means it runs. A Cloudflare error page means the deploy failed. Open **Workers & Pages**, then **rivian-mcp**, then **Deployments** to see why.

## Sign in

Claude, ChatGPT and Codex all open the same two pages from your copy when they connect. Each page names the app requesting access.

1. Enter your Rivian email and password and select **Sign in and allow**. The first account that signs in becomes the owner of your copy, so connect right after you deploy.

   ![Step 1 of 2 on the sign-in page: the app that asks for access, and the Rivian email and password fields](images/sign-in-step-1.png)

2. Rivian sends a one-time code to your phone or email. Enter it and select **Verify and connect**.

   ![Step 2 of 2 on the sign-in page: the one-time code field](images/sign-in-step-2.png)

Your Worker forwards the password to Rivian for sign-in. It does not store the password.

## Connect Claude

Works on claude.ai and in the Claude desktop and mobile apps. Custom connectors are available on Free (one connector), Pro, Max, Team and Enterprise ([Anthropic's guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-MCP)).

1. In Claude, open **Settings**, then **Connectors**.
2. Select **Add custom connector**.
3. Name it `Rivian` and paste your connector address. Leave the advanced settings empty.
4. Select **Add**, then **Connect**.
5. Your sign-in page opens. [Sign in](#sign-in) with your Rivian email, password and one-time code.
6. You are back in Claude, and recording has started.

Try it: in a new chat, turn on the Rivian connector in the **+** menu and ask "Is the recorder running?" Drives show up after your next trip. Ask "Show me the last drive on the map" for the route and the drive's numbers.

![Claude showing a recorded drive with its route on a map, distance, speed and elevation](images/claude-show-drive.png)

The same card works in the Claude mobile app. Ask "Show me the last drive" and scroll for the map and the elevation and speed charts.

<p>
  <img src="images/claude-mobile-drive-card.png" width="300" alt="The Claude iPhone app showing the drive card with distance, speed and elevation tiles">
  <img src="images/claude-mobile-drive-charts.png" width="300" alt="The Claude iPhone app showing the elevation and speed charts of the same drive">
</p>

On Team and Enterprise plans, an owner adds the connector under **Organization settings**, then **Connectors**. Each member then selects **Connect**.

## Connect ChatGPT

Tested in the ChatGPT desktop app. Which plans include custom MCP servers is in [OpenAI's help article](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta).

1. In ChatGPT, open **Customize**, then **Plugins**.
2. Select **Add**, then **Add custom MCP server**.
3. Name it `Rivian`. Under **Connection**, keep **Server URL** and paste your connector address.
4. Leave **Authentication** on **OAuth or no authentication**. Leave the advanced OAuth settings alone.
5. Check **I understand and want to continue**, then select **Create as a plugin**.

   ![ChatGPT's Add custom MCP server dialog with the name Rivian, the connector address and OAuth authentication](images/chatgpt-add-custom-mcp-server.png)

6. Your sign-in page opens. [Sign in](#sign-in) with your Rivian email, password and one-time code.

Try it: in a new chat, ask "Rivian status".

![ChatGPT answering "Rivian status" with battery level, charging state, charge limit and estimated range](images/chatgpt-rivian-status.png)

## Connect Codex

Tested in the Codex desktop app.

1. In Codex, open **Settings**, then **Plugins** under **Integrations**.
2. Select **Add**, then **Add MCP server**.

   ![Codex's Plugins settings with the Add menu open and Add MCP server highlighted](images/codex-add-mcp-server.png)

3. Name it `Rivian`. Set **Type** to **Streamable HTTP** and paste your connector address. Leave the bearer token and the headers empty.
4. Select **Save**.

   ![Codex's Connect to a custom MCP form with the name Rivian, type Streamable HTTP and the connector address](images/codex-connect-custom-mcp.png)

5. In a new chat, ask "Connect to Rivian". Codex finds the server you added and opens the sign-in page in your browser.

   ![Codex working on "connect to rivian": it reads the local setup and finds the Rivian MCP address](images/codex-connect-to-rivian.png)

6. [Sign in](#sign-in) with your Rivian email, password and one-time code. The browser then shows "Authentication complete. You may close this window."

   ![A browser tab at a 127.0.0.1 callback address that reads "Authentication complete. You may close this window."](images/codex-authentication-complete.png)

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

Cloudflare automatically deploys changes pushed to the production branch.

## Your data

- Recorded drives, points, charging samples and cached place labels are stored in your Cloudflare D1 database. The Recorder Durable Object stores the Rivian session, owner and pending sign-ins; KV stores connector OAuth state. Tool results are sent to the AI app you connect. To look at the rows, open **Storage & Databases**, then **D1**, then **rivian-mcp**, then **Studio**.

  ![Cloudflare's D1 Studio showing the charge_samples table of the rivian-mcp database](images/cloudflare-d1-charge-samples.png)

- Place names for drive starts and ends come from [Photon](https://photon.komoot.io) (komoot's OpenStreetMap geocoder). The Worker sends it the coordinate rounded to about 100 m, with no account or drive id, and caches the answer in D1 so each place is asked once. Labels stop at the neighborhood or city; no street or house number is stored or shown.
- Map views request basemap tiles from Esri (`server.arcgisonline.com`). Tile requests reveal the map area being viewed and the requesting client's IP address, but do not contain the drive payload.
- Your Rivian password passes through your Worker to Rivian and is not stored. The Worker keeps the session Rivian returns, the same way the Rivian app stays signed in.
- The first Rivian account that signs in owns your copy. After that, only its email can sign in. Sign-in attempts are limited to 10 per minute.
- Until you sign in, anyone who finds your address can claim your copy with their own Rivian account. Connect right after you deploy. To pin the owner up front, add a `RIVIAN_EMAIL` secret: **Settings**, then **Variables and Secrets**.
- Anyone who finds your address can try passwords for the owner's email, within that limit.

## Remove it

In the Cloudflare dashboard, open **Workers & Pages**, select **rivian-mcp**, then **Settings**, then **Delete**. Deleting the Worker also deletes the recorder's Durable Object and everything it stored. Under **Storage & Databases**, delete the D1 database and the KV namespace whose names start with `rivian-mcp`. Remove the connector in Claude or ChatGPT. You can delete your copy on GitHub too.

### Deleting the Cloudflare account

Cloudflare documents a self-service path under **My Profile**, then **Delete this user**, after removing domains, subscriptions and payment information. Deleting the profile also deletes associated accounts. To remove only this project, follow [Remove it](#remove-it). See [Cloudflare's deletion guide](https://developers.cloudflare.com/fundamentals/user-profiles/delete-account/) for the exact scope and prerequisites.

In a project test account, deletion was blocked by an active Workers Free subscription with no cancellation control. If that happens, contact Cloudflare support. This was a project test result, not a restriction documented for all Worker accounts.

## Set it up from a terminal instead

If you would rather not use GitHub or the browser, you need [Node.js 24](https://nodejs.org) or newer.

```sh
git clone https://github.com/zentered-studios/rivian-mcp.git
cd rivian-mcp
npm ci
npx wrangler login
npm run deploy
```

`npm run deploy` creates the storage on the first run, deploys, and sets up the database. Answer `y` if it asks. To update later, run `git pull`, `npm ci` and `npm run deploy` again.
