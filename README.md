# amazon-scraper-api-mcp

[![npm](https://img.shields.io/npm/v/amazon-scraper-api-mcp)](https://www.npmjs.com/package/amazon-scraper-api-mcp)
[![npm downloads](https://img.shields.io/npm/dm/amazon-scraper-api-mcp)](https://www.npmjs.com/package/amazon-scraper-api-mcp)
[![license](https://img.shields.io/npm/l/amazon-scraper-api-mcp)](./LICENSE)
[![Glama MCP server](https://glama.ai/mcp/servers/ChocoData-com/amazon-scraper-api-mcp/badges/score.svg)](https://glama.ai/mcp/servers/ChocoData-com/amazon-scraper-api-mcp)

**MCP (Model Context Protocol) server for [Amazon Scraper API](https://www.amazonscraperapi.com/).** Plugs into Claude Desktop, Cursor, Claude Code, Continue, or any MCP-compatible AI client. Gives your model live Amazon product data as a first-class tool call.

## What it unlocks

> "Find me the highest-rated wireless earbuds under $150 on amazon.com, then check if they're cheaper on amazon.de"

That's **one prompt**. Without MCP, your AI can't fetch Amazon pages (Amazon blocks LLM browsing) and has zero recency for prices and stock. With this MCP server, it calls `amazon_search` + `amazon_product` directly and comes back with structured data from [Amazon Scraper API](https://www.amazonscraperapi.com/).

## Tools exposed

| Tool | What it does | Typical use |
|---|---|---|
| `amazon_product` | Fetch one product by ASIN or URL | "get price + rating for B09HN3Q81F" |
| `amazon_search` | Keyword search with sort/filter | "top 10 cast iron skillets under $50" |
| `amazon_batch_create` | Queue up to 1000 ASINs for async scrape | "scrape all 500 products in my catalog, webhook me when done" |
| `amazon_batch_status` | Poll a batch's progress | "how much of batch xyz is done?" |

Each returns structured JSON: title, price, rating, reviews count, availability, buybox, variants, images, bullets, categories, spec tables.

## Benchmark (live production, 2026-04)

| Metric | Value |
|---|---|
| Median latency (product, US) | **~2.6 s** |
| P95 latency | **~6 s** |
| Price / 1,000 requests | **$0.50** flat |
| Marketplaces | **20+** |

## Claude Desktop setup

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "amazon-scraper": {
      "command": "npx",
      "args": ["-y", "amazon-scraper-api-mcp"],
      "env": {
        "ASA_API_KEY": "asa_live_..."
      }
    }
  }
}
```

Restart Claude Desktop. Tools appear under the MCP icon in the chat composer.

## Cursor setup

Settings → **MCP** → **Add server**:
- **Command:** `npx -y amazon-scraper-api-mcp`
- **Env:** `ASA_API_KEY=asa_live_...`

## Claude Code setup

```bash
claude mcp add amazon-scraper -- npx -y amazon-scraper-api-mcp
# then set ASA_API_KEY in the environment Claude Code runs in
```

## Example conversation (Claude Desktop)

> **You:** What's the current price of AirPods Pro 3rd gen on amazon.com?
>
> **Claude:** *[calls `amazon_product` with ASIN B09HN3Q81F]*
>
> The AirPods Pro 3rd gen are currently **$199.00** on amazon.com, down from $249.00 (20% off). They have a 4.7-star rating from 58,214 reviews and are in stock, shipping from and sold by Amazon.com with Prime.

> **You:** Compare that to the German Amazon listing.
>
> **Claude:** *[calls `amazon_product` with `query=B09HN3Q81F, domain=de`]*
>
> On **amazon.de** the same product is listed at **229.00 EUR**. At today's exchange rate that's about $245, roughly 23% more than the US price. German listing ships from Amazon and qualifies for Prime delivery.

## Why this vs. a generic "browse the web" MCP

Generic browser tools that try to load `amazon.com` typically get blocked (robot check) or serve a mobile-stripped page. This server routes every call through [Amazon Scraper API](https://www.amazonscraperapi.com/), which:

- Detects and retries robot/CAPTCHA pages through escalating proxy tiers
- Returns structured JSON (typed fields), not HTML soup
- Supports 20+ marketplaces with country-matched residential IPs
- Handles batch (hundreds to thousands of ASINs) with webhook delivery
- Built-in rate-limit backoff

## Error handling

Errors are surfaced to the model as tool errors with a `code` field and a hint. The model then decides whether to retry or abandon the sub-task. You don't have to write error-handling logic yourself.

Common codes: `INVALID_API_KEY`, `INSUFFICIENT_CREDITS`, `RATE_LIMITED`, `target_unreachable`, `amazon-robot-or-human`, `extraction_failed`, `SERVICE_OVERLOADED`. Full table: [amazonscraperapi.com/docs/errors](https://amazonscraperapi.com/docs/errors).

## Get an API key

[app.amazonscraperapi.com](https://app.amazonscraperapi.com). **1,000 free requests on signup, no credit card required.** Enough to test every tool this MCP exposes plus a few dozen productive chats.

## Links

- **Website:** https://www.amazonscraperapi.com/
- **Docs:** https://amazonscraperapi.com/docs
- **Status:** https://amazonscraperapi.com/status
- **Pricing:** https://amazonscraperapi.com/pricing
- **Node SDK:** [amazon-scraper-api-sdk](https://www.npmjs.com/package/amazon-scraper-api-sdk) · **Python SDK:** [amazonscraperapi-sdk](https://pypi.org/project/amazonscraperapi-sdk/) · **Go SDK:** [github.com/ChocoData-com/amazon-scraper-api-sdk-go](https://github.com/ChocoData-com/amazon-scraper-api-sdk-go) · **CLI:** [amazon-scraper-api-cli](https://www.npmjs.com/package/amazon-scraper-api-cli)

## License

MIT
