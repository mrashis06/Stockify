
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
    size: z.string().describe('The volume or size of the product (e.g., "750ml", "500ml").'),
    quantity: z.number().describe('The number of units for this item.'),
    category: z.string().describe('The category of the liquor (e.g., "Whiskey", "Rum", "Beer", "Wine").'),
});
export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

// Define the input schema for the flow
const BillExtractionInputSchema = z.object({
  billDataUri: z
    .string()
    .describe(
      "A bill or invoice as a data URI that must include a MIME type (image or pdf) and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type BillExtractionInput = z.infer<typeof BillExtractionInputSchema>;


// Define the output schema for the flow
const BillExtractionOutputSchema = z.object({
  items: z.array(ExtractedItemSchema).describe('An array of items extracted from the bill.'),
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
  output: {schema: BillExtractionOutputSchema},
  prompt: `You are an expert data entry agent for a liquor store. Your task is to extract all line items from the provided bill/invoice image.

Analyze the document carefully and identify each product. For each product, extract the following details:
- brand: The brand name of the product.
- size: The volume of the bottle (e.g., 750ml, 180ml, 500ml).
- quantity: The number of units or bottles.
- category: The type of liquor (e.g., Whiskey, Rum, Beer, Vodka, Wine, Gin, Tequila, IML).

Return the data as a structured array of items. If you cannot determine a piece of information for an item, make your best guess.

Bill document: {{media url=billDataUri}}`,
});


// Define the Genkit flow
const extractBillFlow = ai.defineFlow(
  {
    name: 'extractBillFlow',
    inputSchema: BillExtractionInputSchema,
    outputSchema: BillExtractionOutputSchema,
  },
  async input => {
    const {output} = await billExtractionPrompt(input);
    return output!;
  }
);
