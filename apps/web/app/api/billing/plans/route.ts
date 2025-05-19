import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
// Ensure you have stripe installed: pnpm add stripe
import Stripe from 'stripe';
import { env } from '@notion-lifeline/config';

let stripe: Stripe | null = null;

const stripeSecretKey = env.STRIPE_SECRET_KEY;
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
    typescript: true,
  });
} else {
  console.warn('STRIPE_SECRET_KEY not set. Stripe functionality will be disabled.');
}

// Define a type for the plan structure you want to return to the frontend
// Matches the structure used in the UpgradeModal component
interface PlanData {
  id: string; // Stripe Price ID
  productId?: string;
  name: string; // Product Name 
  nickname: string | null; // Price Nickname (e.g., "Pro Monthly", "Pro Annual")
  price: string; 
  priceDescription: string; // e.g., "/ month" or "/ year"
  interval: Stripe.Price.Recurring.Interval | null;
  features: string[]; 
  productMetadata: Stripe.Metadata;
}

export async function GET(request: Request) {
  if (!stripe) {
    console.warn('Skipping Stripe pricing fetch – STRIPE_SECRET_KEY not set or Stripe not initialized.');
    return NextResponse.json({ plans: [] }); // Use the plans key as per user instructions for consistency
  }

  try {
    // Optional: Check auth if only logged-in users can see plans,
    // but typically pricing is public.
    // const { userId } = await auth();
    // if (!userId) {
    //   return new NextResponse("Unauthorized", { status: 401 });
    // }

    console.log("Fetching active products from Stripe...");
    const products = await stripe.products.list({ active: true });

    const plans: PlanData[] = [];

    for (const product of products.data) {
      console.log(`Fetching prices for product: ${product.id} (${product.name})`);
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        expand: ['data.product'], // Optional: if you need product details again here, though we have it
      });

      for (const price of prices.data) {
        if (price.unit_amount !== null) { // Ensure price has an amount
          const formattedPrice = `$${(price.unit_amount / 100).toFixed(2)}`;
          const priceDescription = price.recurring?.interval 
            ? `/ ${price.recurring.interval}` 
            : '';
          
          // Ensure product is a Product object if expanded, or use the outer product
          const currentProduct = typeof price.product === 'string' ? product : price.product as Stripe.Product;

          const features = currentProduct.metadata.features 
            ? currentProduct.metadata.features.split(';').map((f: string) => f.trim()) 
            : (price.metadata.features ? price.metadata.features.split(';').map((f: string) => f.trim()) : []);

          plans.push({
            id: price.id,
            productId: currentProduct.id,
            name: currentProduct.name,
            nickname: price.nickname,
            price: formattedPrice,
            priceDescription: priceDescription,
            interval: price.recurring?.interval || null,
            features: features,
            productMetadata: currentProduct.metadata,
          });
        }
      }
    }
      
    console.log(`Returning ${plans.length} individual price plans.`);
    return NextResponse.json(plans, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
      }
    });

  } catch (error) {
    console.error("Error fetching plans from Stripe:", error);
    const status = error instanceof Stripe.errors.StripeError ? error.statusCode || 500 : 500;
    const message = error instanceof Stripe.errors.StripeError ? `Stripe Error: ${error.message}` : "Internal Server Error";
    return new NextResponse(message, { 
      status, 
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
      }
    });
  }
} 