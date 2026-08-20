import { fetchAuthSession } from "aws-amplify/auth";

export async function authHeaders(
  headersToAdd: Record<string, string> = {},
): Promise<HeadersInit> {
  const token = (await fetchAuthSession()).tokens?.idToken?.toString();
  if (!token) throw new Error("Your session has expired. Please log in again.");
  return {
    ...headersToAdd,
    authorization: `Bearer ${token}`,
  };
}
