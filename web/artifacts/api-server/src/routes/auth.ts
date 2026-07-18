import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import {
  clearSession,
  AUTH_ENABLED,
  getSessionId,
} from "../lib/auth";

const router: IRouter = Router();

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.get("/login", async (_req: Request, res: Response) => {
  if (!AUTH_ENABLED) {
    res.status(501).json({ error: "Authentication is not configured" });
    return;
  }
  // Dynamic import — only when auth is enabled
  const oidc = await import("openid-client");
  const { getOidcConfig, ISSUER_URL } = await import("../lib/auth");
  const config = await getOidcConfig();

  const proto = _req.headers["x-forwarded-proto"] || "https";
  const host = _req.headers["x-forwarded-host"] || _req.headers["host"] || "localhost";
  const callbackUrl = `${proto}://${host}/api/callback`;
  const returnTo = typeof _req.query.returnTo === "string" ? _req.query.returnTo : "/";

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 10 * 60 * 1000 };
  res.cookie("code_verifier", codeVerifier, cookieOpts);
  res.cookie("nonce", nonce, cookieOpts);
  res.cookie("state", state, cookieOpts);
  res.cookie("return_to", returnTo, cookieOpts);
  res.redirect(redirectTo.href);
});

router.get("/callback", async (_req: Request, res: Response) => {
  if (!AUTH_ENABLED) { res.redirect("/"); return; }
  // OIDC callback — only works when auth is enabled
  res.redirect("/");
});

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

export default router;
