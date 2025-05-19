import { z } from 'zod';

export const env = z
  .object({
    STRIPE_SECRET_KEY: z.string().min(1),
    OPENAI_API_KEY: z.string().optional(),
    PINECONE_API_KEY: z.string().optional(),
    PINECONE_INDEX_NAME: z.string().optional(),
    GCP_PROJECT_ID: z.string().min(1),
    GCP_SERVICE_ACCOUNT_KEY_JSON: z.string().optional(),
  })
  .parse(process.env); 