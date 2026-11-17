// @vitest-environment node
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
	authChallenge,
	clerkIssuerFromPublishableKey,
	createClerkTokenVerifier,
	parseBearerToken,
} from "./auth";

const issuer = "https://calm-cricket-82.clerk.accounts.dev";
const resource = "https://gather.example/mcp";

async function signer() {
	const { privateKey, publicKey } = await generateKeyPair("RS256");
	const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
	const keys = createLocalJWKSet({ keys: [jwk] });
	const sign = (
		claims: Record<string, unknown>,
		aud = resource,
		iss = issuer,
	) =>
		new SignJWT(claims)
			.setProtectedHeader({ alg: "RS256", kid: "k1" })
			.setIssuer(iss)
			.setAudience(aud)
			.setSubject("user_1")
			.setIssuedAt()
			.setExpirationTime("1h")
			.sign(privateKey);
	return { keys, sign };
}

describe("MCP auth", () => {
	it("derives Clerk's issuer from a publishable key", () => {
		expect(
			clerkIssuerFromPublishableKey(
				"pk_test_Y2FsbS1jcmlja2V0LTgyLmNsZXJrLmFjY291bnRzLmRldiQ",
			),
		).toBe(issuer);
		expect(
			clerkIssuerFromPublishableKey("pk_live_Y2xlcmsuYXBwZWxlbnQubmwk"),
		).toBe("https://clerk.appelent.nl");
	});

	it("parses only well-formed bearer headers", () => {
		expect(parseBearerToken("Bearer abc")).toBe("abc");
		expect(parseBearerToken("bearer abc")).toBe("abc");
		expect(parseBearerToken("Basic abc")).toBeUndefined();
		expect(parseBearerToken("Bearer a b")).toBeUndefined();
		expect(parseBearerToken(null)).toBeUndefined();
	});

	it("accepts a token for this resource and reads its scopes", async () => {
		const { keys, sign } = await signer();
		const verify = createClerkTokenVerifier(issuer, keys);
		const token = await sign({
			scope: "openid gather:read gather:write",
			client_id: "client_1",
		});
		const access = await verify(token, resource);
		expect(access?.userId).toBe("user_1");
		expect(access?.clientId).toBe("client_1");
		expect([...(access?.scopes ?? [])].sort()).toEqual([
			"gather:read",
			"gather:write",
			"openid",
		]);
	});

	it("rejects tokens for another audience or issuer", async () => {
		const { keys, sign } = await signer();
		const verify = createClerkTokenVerifier(issuer, keys);
		expect(
			await verify(await sign({}, "https://other.example/mcp"), resource),
		).toBeUndefined();
		expect(
			await verify(await sign({ client_id: "c" }, "convex"), resource),
		).toBeUndefined();
		expect(
			await verify(await sign({}, resource, "https://evil.example"), resource),
		).toBeUndefined();
		expect(await verify("not-a-jwt", resource)).toBeUndefined();
	});

	it("rejects an expired token and one without client_id", async () => {
		const { keys, sign } = await signer();
		const verify = createClerkTokenVerifier(issuer, keys);
		// A session token for this audience is still not an OAuth grant.
		expect(
			await verify(await sign({ scope: "gather:read" }), resource),
		).toBeUndefined();
		const { privateKey, publicKey } = await generateKeyPair("RS256");
		const jwk = { ...(await exportJWK(publicKey)), kid: "k2", alg: "RS256" };
		const expired = await new SignJWT({ client_id: "c", scope: "gather:read" })
			.setProtectedHeader({ alg: "RS256", kid: "k2" })
			.setIssuer(issuer)
			.setAudience(resource)
			.setSubject("user_1")
			.setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
			.setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
			.sign(privateKey);
		const verifyK2 = createClerkTokenVerifier(
			issuer,
			createLocalJWKSet({ keys: [jwk] }),
		);
		expect(await verifyK2(expired, resource)).toBeUndefined();
	});

	it("points the challenge at protected resource metadata", () => {
		const challenge = authChallenge(
			new Request("https://gather.example/mcp"),
			"invalid_token",
		);
		expect(challenge).toContain('error="invalid_token"');
		expect(challenge).toContain(
			'resource_metadata="https://gather.example/.well-known/oauth-protected-resource/mcp"',
		);
		expect(challenge).toContain("gather:read");
	});
});
