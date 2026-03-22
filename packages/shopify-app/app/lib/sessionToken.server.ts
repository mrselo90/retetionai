export function requireSessionTokenAuthorization(request: Request) {
  const authorization = request.headers.get("Authorization")?.trim() || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({
        error: "Missing Shopify session token in Authorization header",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new Response(
      JSON.stringify({
        error: "Empty Shopify session token",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return authorization;
}
