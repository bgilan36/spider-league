/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  distDir: "dist",
  images: {
    disableStaticImages: true,
    unoptimized: true,
  },
};

export default nextConfig;
