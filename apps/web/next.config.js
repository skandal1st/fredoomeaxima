/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output is only needed for the Docker image. It uses symlinks that
  // Windows blocks without admin/developer mode, so gate it behind an env var
  // (set in apps/web/Dockerfile) to keep local `pnpm build` working everywhere.
  ...(process.env.NEXT_OUTPUT_STANDALONE === '1' ? { output: 'standalone' } : {}),
  transpilePackages: ['@aximavpn/shared'],
};

module.exports = nextConfig;
