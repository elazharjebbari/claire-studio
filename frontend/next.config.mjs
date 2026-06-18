/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Base URL de l'API CLAIRE (CONTRACT §3). Surchargeable par l'environnement.
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1",
    // Active le mock MSW côté navigateur en dev si non branché au backend.
    NEXT_PUBLIC_ENABLE_MOCKS: process.env.NEXT_PUBLIC_ENABLE_MOCKS ?? "true",
  },
};

export default nextConfig;
