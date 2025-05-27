import axios from 'axios';
import * as fuzz from 'fuzzball';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from 'zod';

const disSearchUrl = "https://discord.com/api/v9/guilds/571992648190263317/messages/search";
const disHeaders = {
  "Authorization": process.env.DISCORD_AUTHORIZATION,
  "User-Agent": "Mozilla/5.0"
};

const genAI = new GoogleGenerativeAI(process.env.GENAI_API_KEY || '');

const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  systemInstruction: `
You are an AI specialized in determining the price of items based on user-provided data.

#### Pricing Rules:
1. Currency Conversion:
   - If a price is given without a currency name, assume WL.
   - 100 WL = 100 DL = 1 BGL.

2. Response Format:
   - Respond only with JSON following:
     - "each" type for individual items.
     - "per" type for bulk items.

### JSON Examples:

For "each":
{
  "Item_Name": "<item name>",
  "item_price": <average price in WL>,
  "priceindl": "<formatted BGL/DL/WL>",
  "type": "each"
}

For "per":
{
  "Item_Name": "<item name>",
  "item_price": <amount per WL>,
  "type": "per"
}

Ignore unreasonable prices and filter by fuzzy matching.
`
});

const normalizeString = s => s.replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase();

const searchFuzzy = (itemName, line, threshold = 80) => {
  const normItem = normalizeString(itemName);
  const normLine = normalizeString(line);
  return fuzz.partial_ratio(normItem, normLine) >= threshold;
};

const formatPrice = (wlPrice) => {
  let priceNum = typeof wlPrice === 'string' ? parseInt(wlPrice, 10) : wlPrice;
  if (isNaN(priceNum)) return "Invalid Price";

  priceNum = Math.floor(priceNum);
  const bgl = Math.floor(priceNum / 10000);
  const rem = priceNum % 10000;
  const dl = Math.floor(rem / 100);
  const wl = rem % 100;

  const parts = [];
  if (bgl) parts.push(`${bgl} BGL`);
  if (dl) parts.push(`${dl} DL`);
  if (wl) parts.push(`${wl} WL`);
  return parts.length ? parts.join(" ") : "0 WL";
};

const PriceResponseSchema = z.object({
  Item_Name: z.string(),
  item_price: z.number(),
  priceindl: z.string().optional().nullable(),
  type: z.enum(["each", "per"]),
});

export async function checkItemPrice(itemName) {
  if (!itemName) throw new Error("Item name missing");

  try {
    const discordRes = await axios.get(disSearchUrl, {
      headers: disHeaders,
      params: { content: itemName },
    });

    if (discordRes.status !== 200) throw new Error("Discord search failed");

    const messages = discordRes.data?.messages || [];

    const priceRegex = /(\d+(?:[\.,]\d+)?(?:k|m|b)?\s*(?:wl|dl|bgl)?)|(\d+\/\d+)/i;
    const filteredLines = new Set();

    for (const group of messages) {
      if (group && group.length > 0) {
        const content = group[0]?.content;
        if (!content) continue;

        const lines = content.split('\n');
        for (const line of lines) {
          if (priceRegex.test(line) && searchFuzzy(itemName, line, 80)) {
            filteredLines.add(line.trim());
          }
        }
      }
    }

    if (filteredLines.size === 0) throw new Error("No relevant messages found");

    const aiPrompt = `itnm: ${itemName}\n` + [...filteredLines].join("\n");

    const aiResult = await geminiModel.generateContent(aiPrompt);
    const aiText = aiResult.response.text();

    const cleanJson = aiText.replace(/^```json\s*|```$/g, "").trim();
    let priceData = PriceResponseSchema.parse(JSON.parse(cleanJson));

    if (priceData.type === "each" && priceData.item_price != null) {
      priceData.priceindl = formatPrice(priceData.item_price);
    } else {
      priceData.priceindl = null;
    }

    return priceData;

  } catch (err) {
    throw err;
  }
}
