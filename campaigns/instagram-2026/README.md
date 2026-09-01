# AWT Instagram campaign automation

The daily GitHub Action checks the complete Buffer queue and refills open Free-plan slots with the next entries from `campaign.mjs`. Campaign times are stored in UTC: `02:00Z` is `10:00` in Asia/Makassar (WITA).

## Required repository secret

Create a one-year Buffer personal API key with only `accountRead`, `postsRead`, and `postsWrite`. Add it under **Settings → Secrets and variables → Actions** as `BUFFER_API_KEY`.

Never commit the key or paste it into an issue, workflow input, log, or campaign file.

## First activation

1. Open **Actions → Refill Buffer Instagram queue → Run workflow**.
2. Leave **dry_run** enabled and verify the job summary finds the `alanawinatrudi` Instagram channel, the Makassar timezone, and the existing queue without creating posts.
3. Run it again with **dry_run** disabled only after a Free-plan slot has opened.

Scheduled executions run daily at approximately 10:15 WITA. GitHub may start cron workflows a few minutes late, but every Buffer post uses its fixed campaign publication timestamp.
