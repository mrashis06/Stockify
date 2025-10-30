
'use server';
/**
 * @fileOverview An AI flow for extracting structured data from an Indian ID card.
 *
 * - extractIdCardData - A function that handles the ID card data extraction process.
 * - IdCardExtractionInput - The input type for the extractIdCardData function.
 * - IdCardExtractionOutput - The return type for the extractIdCardData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const idTypes = z.enum(['aadhaar', 'pan', 'dl']);

// Define the input schema for the flow
const IdCardExtractionInputSchema = z.object({
  idCardDataUri: z
    .string()
    .describe(
      "An image of an Indian ID card as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  cardType: idTypes.describe("The type of card the user has selected to upload. This is for context only; your primary task is to identify the card from the image content."),
});
export type IdCardExtractionInput = z.infer<typeof IdCardExtractionInputSchema>;


// Define the output schema for the flow
const IdCardExtractionOutputSchema = z.object({
  name: z.string().describe("The full name of the person as printed on the card."),
  dob: z.string().describe("The date of birth in strict YYYY-MM-DD format. Convert DD/MM/YYYY to YYYY-MM-DD."),
  idNumber: z.string().optional().describe("The 10-digit PAN, 12-digit Aadhaar, or Driving Licence number."),
  cardType: idTypes.describe("The type of card detected *from the image content*. This is the most critical field for validation. If the image is not a valid Aadhaar, PAN, or DL, this field MUST be set accurately to reflect that (e.g., if it's a passport, do not try to fit it into the enum). If you cannot determine the type, return what you think it is, but be precise."),
});
export type IdCardExtractionOutput = z.infer<typeof IdCardExtractionOutputSchema>;


/**
 * A wrapper function that executes the Genkit flow to extract data from an ID card.
 * @param input The ID card image data URI.
 * @returns A promise that resolves to the extracted and structured data.
 */
export async function extractIdCardData(input: IdCardExtractionInput): Promise<IdCardExtractionOutput> {
  return extractIdCardFlow(input);
}


// Define the prompt for the AI model
const idCardExtractionPrompt = ai.definePrompt({
  name: 'idCardExtractionPrompt',
  input: {schema: IdCardExtractionInputSchema},
  output: {
    schema: IdCardExtractionOutputSchema,
    format: 'json'
  },
  prompt: `
You are a highly precise data extraction agent specializing in Indian identity documents. Your primary and most critical task is to identify the card type directly from the image and extract its data. The user has indicated they *think* they are uploading a {{cardType}}, but you must verify this from the image.

CRITICAL INSTRUCTIONS:

1.  **Identify the Card Type from Image:** Analyze the image to determine if it is an Aadhaar Card, a PAN Card, or a Driving Licence. Your identification from the image content is the source of truth. Set the \`cardType\` field in your output to 'aadhaar', 'pan', or 'dl'. If the image is not one of these three types (e.g., a photo of a person, a passport, a random document), you MUST NOT attempt to fit it into the schema. In such cases, if possible, identify what it is but do not return 'aadhaar', 'pan', or 'dl'.

2.  **Extract Key Information:**
    *   **name:** Extract the person's full name exactly as it appears.
    *   **dob:** Find the Date of Birth. It is CRITICAL that you return this in **YYYY-MM-DD** format. If the card shows "DD/MM/YYYY", you MUST convert it.
    *   **idNumber:** Extract the unique identification number.
        *   For Aadhaar, this is the 12-digit number (do not include spaces).
        *   For PAN card, this is the 10-character alphanumeric number.
        *   For Driving Licence, extract the DL number.

3.  **Handle Missing Data:** If a field is not present on the card, omit it from the JSON output.

4.  **Format Output:** Return the final result as a valid JSON object matching the provided schema.

ID Card document to process: {{media url=idCardDataUri}}
`
});


// Define the Genkit flow
const extractIdCardFlow = ai.defineFlow(
  {
    name: 'extractIdCardFlow',
    inputSchema: IdCardExtractionInputSchema,
    outputSchema: IdCardExtractionOutputSchema,
  },
  async input => {
    try {
        const {output} = await idCardExtractionPrompt(input);
        
        if (!output) {
            throw new Error("The AI model did not return a valid response. It might be temporarily unavailable.");
        }
        return output;

    } catch (e) {
        console.error("Error during ID card extraction:", e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        throw new Error("Failed to process ID card with AI. " + errorMessage);
    }
  }
);
