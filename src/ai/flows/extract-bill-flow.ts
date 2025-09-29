
'use server';
/**
 * @fileOverview An AI flow for extracting structured data from an uploaded bill/invoice.
 *
 * - extractItemsFromBill - A function that handles the bill extraction process.
 * - BillExtractionInput - The input type for the extractItemsFromBill function.
 * - BillExtractionOutput - The return type for the extractItemsFromBill function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

// Define the structure for a single extracted item
const ExtractedItemSchema = z.object({
    brand: z.string().describe('The brand name of the product.'),
    size: z.string().describe('The volume or size of the product (e.g., "750ml", "650").'),
    quantity: z.number().describe('The number of units for this item.'),
    category: z.string().describe('The category of the liquor (e.g., "Whiskey", "Rum", "Beer", "Wine").'),
});
export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

// Define the input schema for the flow
const BillExtractionInputSchema = z.object({
  billDataUri: z
    .string()
    .describe(
      "A bill or invoice as a data URI that must include a MIME type (image or pdf) and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
   existingInventory: z.array(z.object({
       id: z.string(),
       brand: z.string(),
       size: z.string(),
   })).describe("A list of existing products in the user's inventory.")
});
export type BillExtractionInput = z.infer<typeof BillExtractionInputSchema>;


// Define the output schema for the flow
const BillExtractionOutputSchema = z.object({
  matchedItems: z.array(z.object({
      productId: z.string().describe("The ID of the matched product from the existing inventory."),
      quantity: z.number().describe("The quantity of the matched product."),
  })).describe("Items from the bill that were successfully matched to existing inventory."),
  unmatchedItems: z.array(ExtractedItemSchema).describe("Items from the bill that could not be matched and need manual processing."),
});
export type BillExtractionOutput = z.infer<typeof BillExtractionOutputSchema>;


/**
 * A wrapper function that executes the Genkit flow to extract items from a bill.
 * @param input The bill data URI.
 * @returns A promise that resolves to the extracted items.
 */
export async function extractItemsFromBill(input: BillExtractionInput): Promise<BillExtractionOutput> {
  return extractBillFlow(input);
}


// Define the prompt for the AI model
const billExtractionPrompt = ai.definePrompt({
  name: 'billExtractionPrompt',
  input: {schema: BillExtractionInputSchema},
  output: {
    schema: BillExtractionOutputSchema,
    format: 'json'
  },
  prompt: `
You are an expert data entry and matching agent for a liquor store. Your task is to extract all line items from the provided bill and match them against the user's existing inventory.

**INSTRUCTIONS:**

1.  **Extract Details**: For each line item on the bill, extract the following details:
    *   `brand`: The brand name (e.g., "Old Monk", "Kingfisher Ultra").
    *   `size`: **Extract ONLY the numeric value of the size.** Discard units like "ml", "ML". (e.g., "750ml" -> "750").
    *   `quantity`: The number of units.
    *   `category`: The type of liquor (Whiskey, Rum, Beer, Vodka, Wine, Gin, Tequila, IML).

2.  **Match Against Inventory**: For each extracted item, compare it to the `existingInventory` list provided. The goal is to find a perfect match based on brand and size. Brand names might be slightly different (e.g., bill says "Kingfisher Beer" and inventory has "Kingfisher"). Use your best judgment to find the correct match.

3.  **Categorize Results**:
    *   **If a match is found**: Add the item to the \`matchedItems\` array. You must provide the \`productId\` from the `existingInventory` and the \`quantity\` from the bill.
    *   **If no match is found**: This is a new product. Add its full extracted details (`brand`, `size`, `quantity`, `category`) to the \`unmatchedItems\` array.

**EXAMPLE:**

*Bill shows:*
*   "McDowell's No.1 750ml - 10 units"
*   "Tuborg Beer 650ml - 5 units"

*existingInventory contains:*
*   `{ id: 'mcdowells_750', brand: 'McDowells', size: '750' }`

*Expected JSON Output:*
\`\`\`json
{
  "matchedItems": [
    {
      "productId": "mcdowells_750",
      "quantity": 10
    }
  ],
  "unmatchedItems": [
    {
      "brand": "Tuborg Beer",
      "size": "650",
      "quantity": 5,
      "category": "Beer"
    }
  ]
}
\`\`\`

**Bill document to process:** {{media url=billDataUri}}
**Existing Inventory to match against:**
{{{jsonStringify existingInventory}}}

Return the final result as valid JSON.
`,
  model: 'googleai/gemini-2.5-flash',
  requestOptions: {
    timeout: 60000, // Increased timeout for a more complex task
  },
});


// Define the Genkit flow
const extractBillFlow = ai.defineFlow(
  {
    name: 'extractBillFlow',
    inputSchema: BillExtractionInputSchema,
    outputSchema: BillExtractionOutputSchema,
  },
  async input => {
    try {
        const {output} = await billExtractionPrompt(input);
        
        if (!output) {
            throw new Error("The AI model did not return a valid response. It might be temporarily unavailable.");
        }
        return output;

    } catch (e) {
        console.error("Error during bill extraction:", e);
        // Catch the error and re-throw it as a standard Error object to avoid crashing the server process.
        // This makes sure a clear, string-based message is sent to the client.
        const errorMessage = e instanceof Error ? e.message : String(e);
        throw new Error("Failed to process bill with AI. " + errorMessage);
    }
  }
);
