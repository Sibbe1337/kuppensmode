import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
// Ensure you have stripe installed: pnpm add stripe
import Stripe from 'stripe';

// Initialize Stripe with your secret key (use environment variable)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("STRIPE_SECRET_KEY environment variable not set.");
  throw new Error("Stripe configuration error"); 
}
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20', // Use the API version you are targeting
  typescript: true,
});

// Define a type for the plan structure you want to return to the frontend
// Matches the structure used in the UpgradeModal component
interface PlanData {
  id: string; // Stripe Price ID (price_...)
  name: string; // Stripe Product Name
  price: string; // Formatted price string (e.g., "$10")
  priceDescription: string; // e.g., "/mo"
  features: string[]; // Features (consider fetching from Product metadata)
  // Add isCurrent logic source if needed (e.g. from user data)
}

export async function GET(request: Request) {
  try {
    // Optional: Check auth if only logged-in users can see plans,
    // but typically pricing is public.
    // const { userId } = await auth();
    // if (!userId) {
    //   return new NextResponse("Unauthorized", { status: 401 });
    // }

    console.log("Fetching active plans from Stripe...");

    // 1. Fetch active Products from Stripe
    // You might filter products based on metadata if you have different types
    const products = await stripe.products.list({
      active: true,
      // Add expand: ['data.default_price'] to fetch default price with product
      expand: ['data.default_price'],
    });

    // 2. Map products and their prices to your PlanData structure
    const plans: PlanData[] = products.data
      .filter(product => product.default_price) // Ensure product has a default price
      .map(product => {
        const price = product.default_price as Stripe.Price;
        
        // Format price (handle different currencies/types as needed)
        const formattedPrice = price.unit_amount !== null 
          ? `$${(price.unit_amount / 100).toFixed(2)}` 
          : 'Contact Us'; // Or handle missing price
        
        const priceDescription = price.recurring?.interval 
          ? `/ ${price.recurring.interval}` 
          : '';
          
        // Fetch features from product metadata (example)
        const features = product.metadata.features 
          ? product.metadata.features.split(';').map(f => f.trim()) 
          : ['Feature 1', 'Feature 2']; // Default features if none in metadata

        return {
          id: price.id, // Use the Price ID
          name: product.name,
          price: formattedPrice,
          priceDescription: priceDescription,
          features: features,
        };
      });
      
    // Add sorting if necessary, e.g., by price or a metadata field
    // plans.sort((a, b) => /* your sorting logic */);

    console.log(`Returning ${plans.length} plans.`);
    return NextResponse.json(plans);

  } catch (error) {
    console.error("Error fetching plans from Stripe:", error);
    if (error instanceof Stripe.errors.StripeError) {
        return new NextResponse(`Stripe Error: ${error.message}`, { status: error.statusCode || 500 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 