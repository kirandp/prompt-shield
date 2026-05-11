/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    typescript: {
        tsconfigPath: './tsconfig.json'
    },
    env: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    },
    // unpdf bundles its own pdfjs build with serverless-safe polyfills.
    // Marking it external keeps Turbopack from re-bundling it.
    serverExternalPackages: ['unpdf']
};

module.exports = nextConfig;
