# ⚡ WORDSPARK! Multiplayer

One shared game for 2–6 players on separate devices. Two modes: in-person spoken conversation and remote typed conversation.

## Rules
- Every player begins with 6 private, single-word cards.
- Opening round: each player plays one card; no statements or points until all players have played.
- Player 1 speaks first. After scoring a statement, that player plays a card; the next player responds.
- Each distinct table card used in the statement scores 1 point. Matches are case-insensitive and simple trailing `s` plurals are accepted.
- Maximum 10 cards on the table; the oldest disappears when an 11th arrives.
- Every played card is replaced. Host can reset or end the game.

## Deploy to Vercel
1. Create a GitHub repository and upload all files **inside this folder** to the repository root.
2. In Vercel, choose **Add New → Project → Import Git Repository**. Framework: Next.js; root: `./`.
3. Provision an Upstash Redis database (via Vercel Marketplace or Upstash console). Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel project environment variables for Production (and Preview if used). Never commit these secrets.
4. Deploy. Share the production URL with players. Each device enters its own name and joins.
5. To run locally: `npm install`, copy `.env.example` to `.env.local` and add Redis credentials, then `npm run dev`.

## Design and limitations
- All clients poll every ~1.2 seconds. No WebSocket infrastructure needed.
- Exactly **one active game** per Redis database/key. New games can be created after the previous game is ended; the host can reset the current game for the same group.
- Redis persists across Vercel function instances and deployments; it is not process-local RAM. All mutations use a short Redis lock to serialize turns.
- Players' tokens are stored in browser localStorage; only their own hand is returned. Avoid sharing a browser profile across different players. A player can reconnect from the same browser after refresh. Tokens are bearer credentials; use HTTPS.
- This is a lightweight family game, not a hardened public multiplayer service. Add rate limits, expiration/reset controls, host recovery, content moderation, and stronger identity if publicly promoted.
- Word deck contains 1,000 unique, single-word cards (including inflections), shuffled server-side.
- Typed statements are visible to all players in both modes, to support scoring and the conversation feed.
- If a player closes their device, the game waits for their return. Host may reset.

## Speech-to-text
During a conversation turn, tap **Speak → Text** to dictate a statement using the browser Web Speech API. Tap **Stop recording**, review/edit the transcript, then **Score statement**. Text input remains available in both modes. Microphone access requires HTTPS (provided by Vercel) and browser permission. Speech recognition support varies by browser and may use a browser-vendor cloud recognition service; it is not guaranteed offline or private to the Redis server. No raw audio is stored by this application; only the submitted transcript is saved to the game history.

## Restart Game
The host can select **🔄 Restart game** at any time (including after a game ends). A confirmation is required. Restart clears scores, table, and conversation history; shuffles and deals six new cards to each existing player; and begins a fresh opening round. Players remain joined and the mode is preserved.

## Live multiplayer preview

After deploying to Vercel and configuring Upstash Redis, open `https://YOUR-DOMAIN.vercel.app/preview` on **each device**. This is the actual multiplayer game using the same shared Redis game state and API as the main app, not a static mockup. Speech-to-text controls are hidden and disabled on `/preview`; players type statements. The `/` route retains optional microphone transcription. Both routes use the same single game, so don't run separate test and production games simultaneously. The static `preview/index.html` file is an informational landing page only; it cannot synchronize devices when opened directly as a file.
