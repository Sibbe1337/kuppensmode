import Stripe from 'stripe';
import { getSecret } from './secrets'; // Assuming secrets.ts is in the same lib dir

let stripe: Stripe | null = null;

/**
 * Initializes and returns the Stripe client instance.
 * Fetches the secret key from Secret Manager on first call.
 * 
 * @throws Error if Stripe secret key is not found.
 */
export async function getStripe(): Promise<Stripe> {
  if (stripe) {
    return stripe;
  }

  console.log('Initializing Stripe client...');
  try {
    const secretKey = await getSecret('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY not found in Secret Manager.');
    }

    // Initialize Stripe with the fetched secret key
    // The API version is recommended to be set explicitly
    stripe = new Stripe(secretKey, {
      apiVersion: '2024-06-20', // Use the latest API version
      typescript: true, // Enable TypeScript support
    });

    console.log('Stripe client initialized successfully.');
    return stripe;

  } catch (error) {
    console.error('Failed to initialize Stripe client:', error);
    throw error; // Re-throw the error to indicate failure
  }
} 