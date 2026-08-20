import { fetchAuthSession } from "aws-amplify/auth";

export async function authHeaders(contentType = false): Promise<HeadersInit> {
  const token = (await fetchAuthSession()).tokens?.idToken?.toString();
  if (!token) throw new Error("Your session has expired. Please log in again.");
  return {
    authorization: `Bearer ${token}`,
    ...(contentType ? { "content-type": "application/json" } : {}),
  };
}
