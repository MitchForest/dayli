/** @type {import('next').NextConfig} */
const nextConfig = {
  // Since we're using middleware, we can't use static export
  // This is fine for the web version, and for Tauri we'll handle it differently
  output: 'standalone',
};

export default nextConfig;
