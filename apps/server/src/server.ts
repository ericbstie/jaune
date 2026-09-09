import type { ReplyProvider } from "./provider";
import { handleConversations } from "./api";
import devicePage from "./device.html.txt" with { type: "text" };
import type { Auth } from "./auth";
import type { SQL } from "bun";

interface ServerDependencies {
  database: SQL;
  generate: ReplyProvider;
  auth: Auth;
  trustedOrigins: readonly string[];
}

async function authenticateConversationRequest(
  request: Request,
  dependencies: ServerDependencies,
): Promise<Response> {
  const { headers, response: session } = await dependencies.auth.api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });
  if (session === null) {
    return new Response(null, { status: 401 });
  }
  const response = await handleConversations(
    request,
    {
      database: dependencies.database,
      userId: session.user.id,
    },
    dependencies.generate,
  );
  for (const [name, value] of headers) {
    response.headers.append(name, value);
  }
  return response;
}

async function routeRequest(request: Request, dependencies: ServerDependencies): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path.startsWith("/api/auth/")) {
    return await dependencies.auth.handler(request);
  }
  if (path === "/device" && request.method === "GET") {
    return new Response(devicePage, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Referrer-Policy": "no-referrer" },
    });
  }
  if (path.startsWith("/api/conversations")) {
    return await authenticateConversationRequest(request, dependencies);
  }
  return new Response(null, { status: 404 });
}

function addCors(response: Response, origin: string | null): Response {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Origin");
  if (origin !== null) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  }
  return response;
}

async function handleRequest(
  request: Request,
  dependencies: ServerDependencies,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin !== null && !dependencies.trustedOrigins.includes(origin)) {
    return new Response(null, { status: 403 });
  }
  if (request.method === "OPTIONS") {
    return addCors(new Response(null, { status: 204 }), origin);
  }
  const response = await routeRequest(request, dependencies);
  return addCors(response, origin);
}

export { handleRequest };
export type { ServerDependencies };
