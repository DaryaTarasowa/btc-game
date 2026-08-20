export function claimsFrom(event) {
  const claims = event?.requestContext?.authorizer?.jwt?.claims;
  if (typeof claims?.sub !== "string" || typeof claims?.email !== "string") {
    throw new Error("Authenticated JWT claims are missing.");
  }
  return claims;
}

export function validUsername(value) {
  if (typeof value !== "string") return null;
  const username = value.trim();
  return /^[\p{L}\p{N}_. -]{2,32}$/u.test(username) ? username : null;
}
