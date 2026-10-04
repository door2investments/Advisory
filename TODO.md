# TODO

## Retire the per-goal share page (`goal-share.html`)

**Status:** deferred by decision, kept working for now.

`summary.html` shows every goal for a client or prospect on one page and is the
link we hand out going forward. `goal-share.html?share=<token>` predates it and
shows exactly one goal.

Both are live on purpose — the per-goal link is still useful for sending a single
goal, and links already sent to prospects must keep working.

When retiring it:

1. Check nothing in the wild still depends on a `goal-share.html` link
   (`client_goals.share_token` is per goal and stays regardless).
2. Redirect `goal-share.html?share=<token>` to the owner's `summary.html`
   rather than deleting the file, so old links survive.
3. Drop the "Share link" row from the goal page's Save & share box, keeping the
   full-plan link.
4. Remove `goal-share.html` / `goal-share.js` once the redirect has been in
   place long enough.

## Deprecated columns on `client_goals`

`prospect_name` and `prospect_mobile` are superseded by `prospect_id` ->
`prospects`. They are still populated on rows created before the prospects
migration and are no longer written. Drop them once the backfill is confirmed:

```sql
alter table public.client_goals drop column prospect_name;
alter table public.client_goals drop column prospect_mobile;
```

## Asset cache busting

`?v=20261004` on the stylesheet and page modules is a manual version string.
**Bump it whenever `style.css` or any page `.js` changes**, or browsers keep
serving the old copy — this has already caused one round of "the buttons have
no styling". A GitHub Action rewriting it to the commit SHA on every push to
`main` would remove the need to remember.

## Known display bugs not yet fixed

Both from `form_responses` columns being `text` where the code assumes booleans:

- `client.js` renders **Health Insurance as "Yes" for every client** — the column
  holds the string `"false"`, which is truthy in JavaScript.
- `client.js` renders **Term Insurance as "No" for every client** — it compares a
  `"true"`/`"false"` string against `"Yes"`.
