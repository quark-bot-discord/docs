# Quark docs

Source for [docs.quark.bot](https://docs.quark.bot), built with [Mintlify](https://mintlify.com).

## Layout

| Path | What it is |
| --- | --- |
| `mint.json` | Site settings, navigation and redirects |
| `*.mdx`, `logs/`, `commands/`, ... | The pages. A page only appears once it is listed under `navigation` in `mint.json` |
| `api-reference/openapi.json` | The API reference. Mintlify builds one page per operation from it |
| `scripts/` | Generator for the reference tables |
| `images/`, `logo/` | Images |

## Preview locally

```
npm i -g mint
mint dev
```

Run it in this folder. Pushing to `main` deploys.

## Reference tables

Two tables are generated from Quark's source:

- the log types table in `logs/types.mdx`, from `SERVERLOG_TYPES` in `constants`
- the command table in `commands/list.mdx`, from `commands.json` in `commands-webserver`

With those two repos checked out next to this one (and `constants` built):

```
node scripts/generate-reference.mjs
```

Only the text between the `GENERATED` markers in each page is replaced.

Three columns of the log types table are kept by hand, in `scripts/`:

- `discord-titles.json`: the title each log type has in Discord, from the English strings in `languages`. Add an entry when a log type is added.
- `NEEDS_AUDIT_LOG` and `NOTES` in `generate-reference.mjs`. The comment there says how they were worked out.

## When something changes in Quark

- New log type or command: run the generator. A message menu command has no description in Discord, so give it one in `MESSAGE_MENU_DESCRIPTIONS` in `generate-reference.mjs` first.
- New or changed API route: update `api-reference/openapi.json`.
- Plan limits and features are stated on several pages. `subscriptions/comparison.mdx` is the full list. Search the repo for `12 hours`, `30 days`, `Last hour`, `25` and `102` to find the rest.
- These pages are linked from the bot and the website, so keep their addresses: `/quickstart`, `/overview`, `/permissions`, `/subscriptions` (a redirect in `mint.json`), `/subscriptions/overview#getting-started`, `/languages/overview`, `/languages/add-language`, `/api-reference/introduction`.

## Contributing

Pull requests are welcome. Keep pages short, lead with what the reader has to do, and use the exact labels the dashboard and Discord show.
