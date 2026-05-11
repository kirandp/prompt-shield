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
    // pdfjs-dist (used by pdf-parse) loads a worker file at runtime from
    // node_modules. Marking these as external prevents Turbopack from
    // bundling them and breaking the worker resolver.
    serverExternalPackages: ['pdf-parse', 'pdfjs-dist']
};

module.exports = nextConfig;
