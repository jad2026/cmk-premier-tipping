/**
 * Turn a Supabase auth error into a short, human-readable sentence.
 *
 * Supabase returns messages like "Invalid login credentials" or, in the worst
 * case, a JSON body such as
 * {"code":400,"error_code":"validation_failed","msg":"..."}. Users (and App
 * Store reviewers) should never see either verbatim.
 */

type AuthErrorLike = { message?: string; code?: string; status?: number } | string | null | undefined;

const GENERIC = "Something went wrong. Please try again.";

const BY_CODE: Record<string, string> = {
  invalid_credentials: "Incorrect email or password. Please try again.",
  email_not_confirmed: "Please confirm your email address before signing in. Check your inbox for the confirmation link.",
  user_not_found: "We couldn't find an account with that email address.",
  user_already_exists: "An account with that email already exists. Try signing in instead.",
  email_exists: "An account with that email already exists. Try signing in instead.",
  weak_password: "That password is too weak. Please choose a longer or more complex password.",
  same_password: "Your new password must be different from your current password.",
  over_request_rate_limit: "Too many attempts. Please wait a moment and try again.",
  over_email_send_rate_limit: "Too many emails sent. Please wait a moment and try again.",
  email_address_invalid: "Please enter a valid email address.",
  provider_disabled: "That sign-in method isn't available. Please sign in with your email and password.",
  session_expired: "Your session has expired. Please sign in again.",
  otp_expired: "That link has expired. Please request a new one.",
  bad_jwt: "This link is invalid or has expired. Please request a new one.",
};

// Fallback matching on the message text for errors that arrive without a code.
const BY_MESSAGE: Array<[RegExp, string]> = [
  [/invalid login credentials/i, BY_CODE.invalid_credentials],
  [/email not confirmed/i, BY_CODE.email_not_confirmed],
  [/already (been )?registered|already exists/i, BY_CODE.user_already_exists],
  [/rate limit|too many requests/i, BY_CODE.over_request_rate_limit],
  [/password should be at least|password.*too short|weak password/i, "Password must be at least 8 characters."],
  [/unsupported provider|provider is not enabled/i, BY_CODE.provider_disabled],
  [/invalid.*email|unable to validate email/i, BY_CODE.email_address_invalid],
  [/expired|invalid token|otp/i, BY_CODE.otp_expired],
  [/failed to fetch|network|load failed/i, "Couldn't reach the server. Please check your connection and try again."],
];

/** Some errors carry a JSON body as their message; pull out the useful bits. */
function unwrapJsonMessage(raw: string): { message: string; code?: string } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return { message: raw };
  try {
    const parsed = JSON.parse(trimmed) as { msg?: string; message?: string; error_code?: string; code?: string | number };
    return {
      message: parsed.msg ?? parsed.message ?? "",
      code: parsed.error_code ?? (typeof parsed.code === "string" ? parsed.code : undefined),
    };
  } catch {
    return { message: "" };
  }
}

export function friendlyAuthError(err: AuthErrorLike): string {
  if (!err) return GENERIC;

  const rawMessage = typeof err === "string" ? err : err.message ?? "";
  const { message, code: jsonCode } = unwrapJsonMessage(rawMessage);
  const code = (typeof err === "object" && err.code) || jsonCode;

  if (code && BY_CODE[code]) return BY_CODE[code];

  for (const [pattern, text] of BY_MESSAGE) {
    if (pattern.test(message)) return text;
  }

  // Only fall through to the original text if it reads like a sentence, never JSON.
  if (message && !message.trim().startsWith("{") && message.length <= 160) return message;
  return GENERIC;
}
