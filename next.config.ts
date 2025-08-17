import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/v1/graphs:start", destination: "/api/v1/graphs/start" },
      { source: "/v1/graphs", destination: "/api/v1/graphs" },
      { source: "/v1/graphs/:graphId", destination: "/api/v1/graphs/:graphId" },
      {
        source: "/v1/branches/:branchId:append",
        destination: "/api/v1/branches/:branchId/append",
      },
      {
        source: "/v1/branches/:branchId:generate:stream",
        destination: "/api/v1/branches/:branchId/generate/stream",
      },
      {
        source: "/v1/branches/:branchId:send:stream",
        destination: "/api/v1/branches/:branchId/send/stream",
      },
      {
        source: "/v1/branches/:branchId:inject",
        destination: "/api/v1/branches/:branchId/inject",
      },
      {
        source: "/v1/branches/:branchId:replaceTip",
        destination: "/api/v1/branches/:branchId/replace-tip",
      },
      {
        source: "/v1/branches/:branchId:jump",
        destination: "/api/v1/branches/:branchId/jump",
      },
      {
        source: "/v1/branches/:branchId:linear",
        destination: "/api/v1/branches/:branchId/linear",
      },
      {
        source: "/v1/nodes/:nodeId:references",
        destination: "/api/v1/nodes/:nodeId/references",
      },
      { source: "/v1/nodes/:nodeId", destination: "/api/v1/nodes/:nodeId" },
      { source: "/v1/blocks", destination: "/api/v1/blocks" },
      { source: "/v1/blocks:ensure", destination: "/api/v1/blocks/ensure" },
    ];
  },
};

export default nextConfig;
