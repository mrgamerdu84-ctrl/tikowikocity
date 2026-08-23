import { createFileRoute } from "@tanstack/react-router";
import { handleSecurityRequest } from "../lib/security-proxy";

export const Route = createFileRoute("/api/security/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const response = await handleSecurityRequest(request);
        return (
          response ??
          new Response(JSON.stringify({ valid: false }), {
            status: 404,
            headers: { "content-type": "application/json; charset=utf-8" },
          })
        );
      },
    },
  },
});
