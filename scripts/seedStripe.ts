#!/usr/bin/env ts-node
import Stripe from 'stripe';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import minimist from 'minimist';

// --- Configuration: Secret Manager Details ---
const GCP_PROJECT_ID = 'notion-lifeline'; // Or make this an argument
const STRIPE_LIVE_SECRET_NAME = 'STRIPE_SECRET_KEY_LIVE'; // Ensure this exists in Secret Manager
const STRIPE_TEST_SECRET_NAME = 'STRIPE_SECRET_KEY_TEST'; // Ensure this exists in Secret Manager

// --- PLANS Definition (as per your patch plan) ---
interface PlanSeed {
  slug: string;
  product: {
    name: string;
    description: string;
  };
  price: {
    unit_amount: number;
    currency: string;
    recurring: { interval: 'month' | 'year' };
    nickname: string;
    // Stripe will multiply unit_amount by quantity for seat-based plans.
    // For annual plans, unit_amount is the per-seat monthly equivalent if interval is 'year'.
    // Stripe handles the annual calculation based on the interval.
  };
  metadata: { // Define all possible metadata fields here
    // Common
    snapshotsLimit: string;
    trialDays: string;
    roleBasedAccess: string;
    // Starter Specific
    workspacesLimit?: string;
    backupFrequency?: string;
    retentionDays?: string;
    exportFormats?: string;
    supportLevel?: string;
    // Pro Specific
    aiDiffViewer?: string;
    aiSummary?: string;
    // Annual Marker
    annualDiscount?: string;  
    // Add other relevant plan features here
  };
}

const PLANS: PlanSeed[] = [
  // --- Starter Plan ---
  { 
    slug: "starter_free", 
    product: { name: "Starter", description: "Peace-of-mind basics for personal notes" }, 
    price: { unit_amount: 0, currency: "usd", recurring: { interval: "month" }, nickname: "Starter Free" },
    metadata: { 
      snapshotsLimit: "5", 
      trialDays: "0", 
      roleBasedAccess: "false", // Implied 1 seat
      workspacesLimit: "1",
      backupFrequency: "weekly", 
      retentionDays: "5",
      exportFormats: "md,json",
      supportLevel: "community",
    }
  },
  
  // --- Pro Plan ---
  { 
    slug: "pro_monthly", 
    product: { name: "Pro", description: "Power-user safety net for solopreneurs & creators" }, 
    price: { unit_amount: 1200, currency: "usd", recurring: { interval: "month" }, nickname: "Pro Monthly" },
    metadata: { 
      snapshotsLimit: "100", 
      trialDays: "14", 
      roleBasedAccess: "false", // Implied solo
      workspacesLimit: "3",
      backupFrequency: "hourly", // Assumed based on context
      retentionDays: "30",
      aiDiffViewer: "true",
      aiSummary: "preview",
      supportLevel: "email_chat_4h",
    }
  },
  { 
    slug: "pro_annual", 
    product: { name: "Pro", description: "Power-user safety net for solopreneurs & creators" }, 
    price: { unit_amount: 900, currency: "usd", recurring: { interval: "year" }, nickname: "Pro Annual" },
    metadata: { 
      snapshotsLimit: "100", 
      trialDays: "14", 
      roleBasedAccess: "false", // Implied solo
      workspacesLimit: "3",
      backupFrequency: "hourly", // Assumed based on context
      retentionDays: "30",
      aiDiffViewer: "true",
      aiSummary: "preview",
      supportLevel: "email_chat_4h",
      annualDiscount: "true",
    }
  },

  // --- Teams Plans (from your patch plan) ---
  {
    slug: "teams_monthly",
    product: {
      name: "Teams",
      description: "Seat-based plan for companies"
    },
    price: {
      unit_amount: 2900, // $29.00 per seat
      currency: "usd",
      recurring: { interval: "month" },
      nickname: "Teams Monthly"
    },
    metadata: { 
      snapshotsLimit: "500",
      trialDays: "14", 
      roleBasedAccess: "true"
    }
  },
  {
    slug: "teams_annual",
    product: { name: "Teams", description: "Seat-based plan for companies" },
    price: {
      unit_amount: 2400, // $24.00 per seat (monthly equivalent for annual billing)
      currency: "usd",
      recurring: { interval: "year" }, 
      nickname: "Teams Annual",
    },
    metadata: { 
      snapshotsLimit: "500",
      trialDays: "14", 
      roleBasedAccess: "true",
      annualDiscount: "true"
    }
  }
];

// --- Helper to fetch secret from Secret Manager ---
let secretManagerClient: SecretManagerServiceClient;
async function getSecret(secretName: string, projectId: string): Promise<string> {
  if (!secretManagerClient) {
    secretManagerClient = new SecretManagerServiceClient();
  }
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
  try {
    console.log(`Fetching secret: ${name}`);
    const [version] = await secretManagerClient.accessSecretVersion({ name });
    const payload = version.payload?.data?.toString();
    if (!payload) {
      throw new Error(`Secret payload for '${secretName}' is empty.`);
    }
    console.log(`Successfully fetched secret: ${secretName}`);
    return payload;
  } catch (error) {
    console.error(`Failed to access secret '${secretName}':`, error);
    throw new Error(`Could not retrieve secret '${secretName}'. Ensure it exists in project '${projectId}' and the current user/SA has permissions.`);
  }
}

// --- Stripe Client Initialization ---
async function getStripeInstance(mode: 'live' | 'test'): Promise<Stripe> {
  const secretName = mode === 'live' ? STRIPE_LIVE_SECRET_NAME : STRIPE_TEST_SECRET_NAME;
  const apiKey = await getSecret(secretName, GCP_PROJECT_ID);
  return new Stripe(apiKey, {
    apiVersion: '2024-06-20', // Use a recent, fixed API version
    typescript: true,
  });
}

// --- Main Seeding Logic ---
async function seedPlans(stripe: Stripe) {
  console.log(`Starting plan seeding for ${PLANS.length} plans...`);

  for (const plan of PLANS) {
    console.log(`\nProcessing plan: ${plan.product.name} (${plan.price.nickname}) - Slug: ${plan.slug}`);

    let productId: string | undefined;

    const productMetadata = {
        ...plan.metadata,
        app_slug: plan.slug, // Store our app's slug for easier lookup
    };

    // Check if product with this app_slug already exists
    let existingProducts = await stripe.products.list({ active: true, limit: 100 });
    let foundProduct = existingProducts.data.find(p => p.metadata.app_slug === plan.slug);

    if (foundProduct) {
      productId = foundProduct.id;
      console.log(`Found existing product ID: ${productId} for slug: ${plan.slug}`);
      // Optionally update product if needed
    } else {
      console.log(`Creating new product for slug: ${plan.slug}`);
      const product = await stripe.products.create({
        name: plan.product.name,
        description: plan.product.description,
        metadata: productMetadata,
      });
      productId = product.id;
      console.log(`Created new product ID: ${productId} - ${plan.product.name}`);
    }

    if (!productId) {
      console.error(`Error: No product ID for plan ${plan.slug}. Skipping price creation.`);
      continue;
    }

    const priceLookupKey = `${plan.slug}_${plan.price.recurring.interval}`;

    const priceMetadata = {
        ...plan.metadata,
        app_price_lookup_key: priceLookupKey,
    };

    let existingPrices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
    let foundPrice = existingPrices.data.find(p => 
        p.nickname === plan.price.nickname &&
        p.recurring?.interval === plan.price.recurring.interval &&
        p.unit_amount === plan.price.unit_amount &&
        p.currency.toLowerCase() === plan.price.currency.toLowerCase() &&
        p.metadata.app_price_lookup_key === priceLookupKey
    );

    let priceId: string | undefined;

    if (foundPrice) {
      priceId = foundPrice.id;
      console.log(`Found existing price ID: ${priceId} for product ${productId} (${plan.price.nickname})`);
    } else {
      console.log(`Creating new price for product ${productId} (${plan.price.nickname})`);
      const priceParams: Stripe.PriceCreateParams = {
        product: productId,
        unit_amount: plan.price.unit_amount,
        currency: plan.price.currency,
        recurring: { interval: plan.price.recurring.interval },
        nickname: plan.price.nickname,
        metadata: priceMetadata,
      };

      const price = await stripe.prices.create(priceParams);
      priceId = price.id;
      console.log(`Created new price ID: ${priceId} - ${plan.price.nickname}`);
    }

    if (priceId) {
      const envVarName = `NEXT_PUBLIC_PRICE_${plan.slug.toUpperCase()}`;
      console.log(`\n--- ENV VARIABLE --- `);
      console.log(`${envVarName}=${priceId}`);
      console.log(`--------------------\n`);
    }
  }
  console.log("Plan seeding finished.");
}

// --- Script Execution ---
async function main() {
  const args = minimist(process.argv.slice(2));
  const mode = args.mode as ('live' | 'test' | undefined);

  if (!mode || (mode !== 'live' && mode !== 'test')) {
    console.error('Usage: ts-node scripts/seedStripe.ts --mode=(live|test)');
    process.exit(1);
  }

  console.log(`Running Stripe seeding in ${mode.toUpperCase()} mode.`);

  try {
    const stripe = await getStripeInstance(mode);
    await seedPlans(stripe);
  } catch (error) {
    console.error('Error during Stripe seeding process:', error);
    process.exit(1);
  }
}

main();