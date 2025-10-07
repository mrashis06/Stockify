
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
  billId: z.string().describe("A unique invoice number, bill number, or receipt ID found on the bill. This is mandatory."),
  matchedItems: z.array(z.object({
      productId: z.string().describe("The ID of the matched product from the existing inventory."),
      quantity: z.number().describe("The quantity of the matched product."),
  })).describe("Items from the bill that were successfully matched to existing inventory."),
  unmatchedItems: z.array(ExtractedItemSchema).describe("Items from the bill that could not be matched and need manual processing."),
});
export type BillExtractionOutput = z.infer<typeof BillExtractionOutputSchema>;


/**
 * A wrapper function that executes the Genkit flow to extract items from a bill.
 * @param input The bill data URI and existing inventory.
 * @returns A promise that resolves to the extracted and categorized items.
 */
export async function extractItemsFromBill(input: BillExtractionInput): Promise<BillExtractionOutput> {
  return extractBillFlow(input);
}


// Define the prompt for the AI model
const billExtractionPrompt = ai.definePrompt({
  name: 'billExtractionPrompt',
  input: {schema: z.object({ ...BillExtractionInputSchema.shape, existingInventoryString: z.string() })},
  output: {
    schema: BillExtractionOutputSchema,
    format: 'json'
  },
  prompt: `
You are an expert data entry and matching agent for a liquor store. Your task is to extract all line items from the provided bill and match them against the user's existing inventory with very high accuracy. You must also extract a unique Bill ID.

INSTRUCTIONS:

0.  **Extract Bill ID (Mandatory):** You MUST find a unique identifier on the bill. This could be labeled "Invoice No.", "Bill No.", "Receipt #", etc. This is a mandatory field. If you cannot find a clear, unique Bill ID on any page of the document, you must return an error and stop. Do NOT invent an ID.

1.  **Process ALL Pages:** If the document is a multi-page PDF, you MUST process every single page to ensure all items and the correct Bill ID are extracted.

2.  **Extract Details:** For each line item on the bill, extract:
    *   **brand:** The brand name (e.g., "Old Monk", "Kingfisher Ultra").
    *   **size:** Extract ONLY the numeric value of the size. Discard units like "ml", "ML". (e.g., "750ml" -> "750").
    *   **quantity:** The number of units.
    *   **category:** The type of liquor (Whiskey, Rum, Beer, Vodka, Wine, Gin, Tequila, IML).

3.  **Strictly Match Against Inventory:** For each extracted item, compare it to the \`existingInventory\` list.
    *   A **MATCH** occurs ONLY IF the brand and size from the bill are a **near-perfect match** to an item in the inventory.
    *   Common abbreviations ARE acceptable (e.g., bill says "I Blue" and inventory has "Imperial Blue").
    *   Descriptive words are fine if they don't conflict (e.g., bill says "Seagrams Royal Stag Whiskey" and inventory has "Royal Stag").
    *   A **MISMATCH** occurs if there are conflicting words. For example, if the inventory has "Royal Stag **Barrel**" but the bill just says "Royal Stag", that is a MISMATCH. The extra word "Barrel" in the inventory item makes it a different product.

4.  **Categorize Results:**
    *   If a **strict match** is found: Add the item to the \`matchedItems\` array. You must provide the \`productId\` from the \`existingInventory\` and the \`quantity\` from the bill.
    *   If **no strict match** is found: This is a new or different product. Add its full extracted details (brand, size, quantity, category) to the \`unmatchedItems\` array for manual user review.


Bill document to process: {{media url=billDataUri}}
Existing Inventory to match against:
{{{existingInventoryString}}}

Return the final result as valid JSON.
`
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
        const {output} = await billExtractionPrompt({
            ...input,
            existingInventoryString: JSON.stringify(input.existingInventory),
        });
        
        if (!output) {
            throw new Error("The AI model did not return a valid response. It might be temporarily unavailable.");
        }
        if (!output.billId || output.billId.trim() === '') {
             throw new Error("The AI model failed to extract a unique Bill ID from the document. Please ensure the bill is clear and try again.");
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
