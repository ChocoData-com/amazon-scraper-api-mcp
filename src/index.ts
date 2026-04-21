#!/usr/bin/env node
/**
 * amazon-scraper-api-mcp — MCP server exposing Amazon Scraper API tools to
 * any MCP client (Claude Desktop, Cursor, Continue, etc.).
 *
 * Install (once the package is published):
 *   npx amazon-scraper-api-mcp
 *
 * Configure in Claude Desktop's claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "amazon-scraper": {
 *         "command": "npx",
 *         "args": ["-y", "amazon-scraper-api-mcp"],
 *         "env": { "ASA_API_KEY": "asa_live_..." }
 *       }
 *     }
 *   }
 *
 * Tools exposed:
 *   - amazon_product: fetch a single product by ASIN
 *   - amazon_search: search Amazon by keyword
 *   - amazon_batch_create: queue up to 1000 ASINs for async processing
 *   - amazon_batch_status: poll a batch job's progress
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { AmazonScraperAPI } from 'amazon-scraper-api-sdk';

const API_KEY = process.env.ASA_API_KEY;
if (!API_KEY) {
  console.error(
    '[amazonscraperapi-mcp] Missing ASA_API_KEY environment variable. Get one at https://app.amazonscraperapi.com'
  );
  process.exit(1);
}

const client = new AmazonScraperAPI(API_KEY);

const server = new Server(
  { name: 'amazonscraperapi', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

// ─── Tool catalogue ────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'amazon_product',
      description:
        'Fetch structured data for a single Amazon product by ASIN. Returns ~55 fields including title, price, variations, reviews, category ladder, images.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '10-character Amazon ASIN, e.g. "B09HN3Q81F"' },
          domain: {
            type: 'string',
            description: 'Amazon marketplace TLD',
            enum: [
              'com', 'co.uk', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'se', 'ca',
              'com.mx', 'com.br', 'com.au', 'co.jp', 'sg', 'in', 'com.tr', 'ae', 'sa', 'eg',
            ],
            default: 'com',
          },
          language: {
            type: 'string',
            description: 'Content language xx_YY (e.g. en_US, de_DE). Not all combos supported per marketplace.',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'amazon_search',
      description:
        'Run an Amazon keyword search. Returns ranked product listings with organic/sponsored positions, prices, ratings, and image URLs.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords' },
          domain: { type: 'string', default: 'com' },
          sort_by: {
            type: 'string',
            enum: ['best_match', 'price_asc', 'price_desc', 'avg_customer_review', 'newest'],
            default: 'best_match',
          },
          start_page: { type: 'number', minimum: 1, maximum: 10, default: 1 },
          pages: { type: 'number', minimum: 1, maximum: 10, default: 1 },
        },
        required: ['query'],
      },
    },
    {
      name: 'amazon_batch_create',
      description:
        'Queue up to 1000 ASINs or search queries for async processing. Returns a batch id — poll with amazon_batch_status or receive a webhook callback.',
      inputSchema: {
        type: 'object',
        properties: {
          endpoint: { type: 'string', enum: ['amazon.product', 'amazon.search'] },
          items: {
            type: 'array',
            maxItems: 1000,
            items: { type: 'object', description: 'Same shape as amazon_product or amazon_search params' },
          },
          webhook_url: { type: 'string', format: 'uri', description: 'Optional HTTPS callback URL' },
        },
        required: ['endpoint', 'items'],
      },
    },
    {
      name: 'amazon_batch_status',
      description: 'Poll an async batch job for progress + results.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  ],
}));

// ─── Tool dispatcher ──────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    let result: unknown;
    switch (name) {
      case 'amazon_product':
        result = await client.product(args as any);
        break;
      case 'amazon_search':
        result = await client.search(args as any);
        break;
      case 'amazon_batch_create':
        result = await client.createBatch(args as any);
        break;
      case 'amazon_batch_status':
        result = await client.getBatch((args as any).id);
        break;
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (e: any) {
    throw new McpError(
      ErrorCode.InternalError,
      e?.message ?? 'Amazon Scraper API request failed'
    );
  }
});

// ─── Start ─────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[amazonscraperapi-mcp] ready on stdio');
}

main().catch((e) => {
  console.error('[amazonscraperapi-mcp] fatal:', e);
  process.exit(1);
});
