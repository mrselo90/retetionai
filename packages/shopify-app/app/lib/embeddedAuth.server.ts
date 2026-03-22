import { authenticate } from "../shopify.server";
import { requireSessionTokenAuthorization } from "./sessionToken.server";

function isDocumentRequest(request: Request) {
  if (request.method.toUpperCase() !== "GET") return false;

  const secFetchDest = request.headers.get("Sec-Fetch-Dest")?.toLowerCase();
  if (secFetchDest === "document" || secFetchDest === "iframe") {
    return true;
  }

  const accept = request.headers.get("Accept")?.toLowerCase() || "";
  return accept.includes("text/html");
}

export async function authenticateEmbeddedAdmin(request: Request) {
  const documentRequest = isDocumentRequest(request);

  if (!documentRequest) {
    requireSessionTokenAuthorization(request);
    console.info("[embedded-auth]", {
      path: new URL(request.url).pathname,
      hasAuthorization: true,
      requestType: "data",
    });
  } else {
    console.info("[embedded-auth]", {
      path: new URL(request.url).pathname,
      hasAuthorization: Boolean(request.headers.get("Authorization")),
      requestType: "document",
    });
  }

  return authenticate.admin(request);
}
