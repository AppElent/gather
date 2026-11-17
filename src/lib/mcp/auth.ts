import {
	createRemoteJWKSet,
	type JWTPayload,
	type JWTVerifyGetKey,
	errors as joseErrors,
	jwtVerify,
} from "jose";
import {
	MCP_READ_SCOPE,
	MCP_WRITE_SCOPE,
} from "../../../convex/lib/connectedApps";
import { reportError } from "../observability/report";

/**
 * OAuth scopes Gather's MCP endpoint understands, created in Clerk. Convex
 * checks the same names (`convex/lib/connectedApps.ts`).
 */
export const MCP_SCOPES = {
	read: MCP_READ_SCOPE,
	write: MCP_WRITE_SCOPE,
} as const;

/** Scopes advertised to clients; `profile` and `email` feed get_current_user. */
export const MCP_SUPPORTED_SCOPES = [
	"openid",
	"profile",
	"email",
	MCP_SCOPES.read,
	MCP_SCOPES.write,
];

export const MCP_PATH = "/mcp";
export const PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";

export type McpAccess = {
	userId: string;
	clientId?: string;
	scopes: ReadonlySet<string>;
	token: string;
};

export type McpTokenVerifier = (
	token: string,
	resource: string,
) => Promise<McpAccess | undefined>;

/** The resource URL clients use: the request's own origin plus /mcp. */
export function mcpResourceUrl(request: Request): string {
	return new URL(MCP_PATH, request.url).href;
}

export function protectedResourceMetadataUrl(request: Request): string {
	return new URL(`${PROTECTED_RESOURCE_PATH}${MCP_PATH}`, request.url).href;
}

/**
 * Clerk's Frontend API, which is the OAuth authorization server and token
 * issuer. A publishable key is `pk_<env>_` + base64("<frontend-api-host>$").
 */
export function clerkIssuerFromPublishableKey(publishableKey: string): string {
	const encoded = publishableKey.replace(/^pk_(test|live)_/, "");
	const host = atob(encoded).replace(/\$$/, "");
	if (!host || host.includes("/")) {
		throw new Error("Invalid Clerk publishable key");
	}
	return `https://${host}`;
}

export function clerkIssuer(): string {
	const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
	if (!key) throw new Error("missing env var VITE_CLERK_PUBLISHABLE_KEY");
	return clerkIssuerFromPublishableKey(key);
}

export function parseBearerToken(header: string | null): string | undefined {
	if (!header) return undefined;
	const [scheme, token, extra] = header.trim().split(/\s+/);
	if (scheme?.toLowerCase() !== "bearer" || !token || extra) return undefined;
	return token;
}

/** Clerk puts granted scopes in `scope` (space separated); accept `scp` too. */
export function grantedScopes(payload: JWTPayload): Set<string> {
	const scopes = new Set<string>();
	if (typeof payload.scope === "string") {
		for (const scope of payload.scope.split(" ")) if (scope) scopes.add(scope);
	}
	if (Array.isArray(payload.scp)) {
		for (const scope of payload.scp)
			if (typeof scope === "string") scopes.add(scope);
	}
	return scopes;
}

const jwksByIssuer = new Map<string, JWTVerifyGetKey>();

/**
 * Verifies a Clerk OAuth JWT access token for this resource. Only access
 * tokens minted for this exact MCP URL (RFC 8707 audience) are accepted, so a
 * session token or a token for another app on the shared Clerk instance fails.
 */
export function createClerkTokenVerifier(
	issuer: string,
	signingKeys?: JWTVerifyGetKey,
): McpTokenVerifier {
	let jwks = signingKeys ?? jwksByIssuer.get(issuer);
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL("/.well-known/jwks.json", issuer));
		jwksByIssuer.set(issuer, jwks);
	}
	const keys = jwks;
	return async (token, resource) => {
		try {
			const { payload } = await jwtVerify(token, keys, {
				issuer,
				audience: resource,
				algorithms: ["RS256"],
			});
			// Clerk OAuth access tokens carry client_id; Convex tells them from
			// the app's own session by it, so a token without one is refused.
			if (!payload.sub || typeof payload.client_id !== "string")
				return undefined;
			return {
				userId: payload.sub,
				clientId: payload.client_id,
				scopes: grantedScopes(payload),
				token,
			};
		} catch (error) {
			// A bad token is the caller's; anything else (Clerk's JWKS
			// unreachable) is ours to hear about.
			if (!(error instanceof joseErrors.JOSEError) || error instanceof joseErrors.JWKSTimeout)
				reportError(error);
			return undefined;
		}
	};
}

export function protectedResourceMetadata(request: Request, issuer: string) {
	return {
		resource: mcpResourceUrl(request),
		resource_name: "Gather",
		authorization_servers: [issuer],
		scopes_supported: MCP_SUPPORTED_SCOPES,
		bearer_methods_supported: ["header"],
	};
}

/** RFC 6750 / RFC 9728 challenge that points clients at the metadata. */
export function authChallenge(
	request: Request,
	error?: "invalid_token" | "insufficient_scope",
): string {
	const parts = [
		`resource_metadata="${protectedResourceMetadataUrl(request)}"`,
		`scope="${MCP_SUPPORTED_SCOPES.join(" ")}"`,
	];
	if (error) parts.unshift(`error="${error}"`);
	return `Bearer ${parts.join(", ")}`;
}
