import {withSentryConfig} from '@sentry/nextjs';
import path from 'path';
import { fileURLToPath } from 'url'; // Import fileURLToPath

// Derive __dirname for ES Module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
  },
  transpilePackages: [
    '@notion-lifeline/storage-adapters',
    '@notion-lifeline/common-types',
  ],
  // Add any Next.js specific configurations here if needed in the future.
  // For example:
  // reactStrictMode: true,
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add the alias for '@/' to point to the 'src' directory
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    // Important: return the modified config
    return config;
  },
};

export default withSentryConfig(nextConfig, {
// For all available options, see:
// https://www.npmjs.com/package/@sentry/webpack-plugin#options

org: "spacekupparen",
project: "test",

// Only print logs for uploading source maps in CI
silent: !process.env.CI,

// For all available options, see:
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

// Upload a larger set of source maps for prettier stack traces (increases build time)
widenClientFileUpload: true,

// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
// This can increase your server load as well as your hosting bill.
// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
// side errors will fail.
tunnelRoute: "/monitoring",

// Automatically tree-shake Sentry logger statements to reduce bundle size
disableLogger: true,

// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
// See the following for more information:
// https://docs.sentry.io/product/crons/
// https://vercel.com/docs/cron-jobs
automaticVercelMonitors: true,
});