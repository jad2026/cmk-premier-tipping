import { Resend } from "resend";

export type EmailMessage = { from: string; to: string; subject: string; html: string };

const MAX_BATCH_SIZE = 100;
const MAX_RETRIES = 4;

function isValidEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const [local, ...rest] = email.split("@");
  const domain = rest.join("@");
  if (!local || !domain || !domain.includes(".")) return false;
  if (/\.{2,}/.test(local)) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  return true;
}

type BatchError = {
  statusCode: number;
  message: string;
  emails: string[];
};

export async function sendEmailBatch(
  messages: EmailMessage[],
  tag: string,
): Promise<{ sent: number; failed: number; skipped: string[]; errors: BatchError[] }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: 0, failed: messages.length, skipped: [], errors: [] };

  const skipped: string[] = [];
  const valid: EmailMessage[] = [];
  for (const m of messages) {
    if (isValidEmail(m.to)) {
      valid.push(m);
    } else {
      skipped.push(m.to);
    }
  }

  if (skipped.length > 0) {
    console.warn(`[${tag}] Skipped ${skipped.length} invalid addresses: ${skipped.join(", ")}`);
  }

  if (valid.length === 0) {
    return { sent: 0, failed: 0, skipped, errors: [] };
  }

  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;
  const errors: BatchError[] = [];

  for (let i = 0; i < valid.length; i += MAX_BATCH_SIZE) {
    const chunk = valid.slice(i, i + MAX_BATCH_SIZE);
    const batchNum = Math.floor(i / MAX_BATCH_SIZE) + 1;
    const batchEmails = chunk.map((m) => m.to);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await resend.batch.send(chunk);

        if (error) {
          const statusCode = (error as { statusCode?: number }).statusCode ?? 0;
          const message = (error as { message?: string }).message ?? "Unknown error";

          if (statusCode === 429 && attempt < MAX_RETRIES) {
            const delay = Math.min(1000 * 2 ** (attempt + 1), 30_000);
            console.warn(`[${tag}] 429 on batch ${batchNum}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }

          if (statusCode === 422) {
            console.warn(`[${tag}] Batch ${batchNum} got 422 — falling back to individual sends for ${chunk.length} emails`);
            const fallback = await sendIndividually(resend, chunk, tag, batchNum);
            sent += fallback.sent;
            failed += fallback.failed;
            if (fallback.failedAddresses.length > 0) {
              errors.push({ statusCode: 422, message, emails: fallback.failedAddresses });
            }
            break;
          }

          console.error(`[${tag}] Batch ${batchNum} failed — status=${statusCode} message="${message}" emails=[${batchEmails.join(", ")}]`);
          errors.push({ statusCode, message, emails: batchEmails });
          failed += chunk.length;
          break;
        }

        const ids = (data as { data: { id: string }[] })?.data ?? [];
        sent += ids.length;
        const batchFailed = chunk.length - ids.length;
        if (batchFailed > 0) {
          console.warn(`[${tag}] Batch ${batchNum} partial: ${ids.length} sent, ${batchFailed} missing IDs`);
          failed += batchFailed;
        }
        break;
      } catch (e: unknown) {
        const statusCode = (e as { statusCode?: number })?.statusCode ?? 0;
        const message = (e as { message?: string })?.message ?? String(e);

        if (statusCode === 429 && attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** (attempt + 1), 30_000);
          console.warn(`[${tag}] 429 (thrown) on batch ${batchNum}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (statusCode === 422) {
          console.warn(`[${tag}] Batch ${batchNum} threw 422 — falling back to individual sends for ${chunk.length} emails`);
          const fallback = await sendIndividually(resend, chunk, tag, batchNum);
          sent += fallback.sent;
          failed += fallback.failed;
          if (fallback.failedAddresses.length > 0) {
            errors.push({ statusCode: 422, message, emails: fallback.failedAddresses });
          }
          break;
        }

        console.error(`[${tag}] Batch ${batchNum} threw — status=${statusCode} message="${message}" emails=[${batchEmails.join(", ")}]`);
        errors.push({ statusCode, message, emails: batchEmails });
        failed += chunk.length;
        break;
      }
    }
  }

  const totalBatches = Math.ceil(valid.length / MAX_BATCH_SIZE);
  console.log(`[${tag}] Batch send complete: ${sent} sent, ${failed} failed, ${skipped.length} skipped (${messages.length} total across ${totalBatches} batches)`);

  if (errors.length > 0) {
    const byStatus = new Map<number, number>();
    for (const e of errors) {
      byStatus.set(e.statusCode, (byStatus.get(e.statusCode) ?? 0) + e.emails.length);
    }
    const breakdown = Array.from(byStatus.entries())
      .map(([code, count]) => `${code}:${count}`)
      .join(", ");
    console.error(`[${tag}] Failure breakdown by status: ${breakdown}`);

    for (const e of errors) {
      console.error(`[${tag}] status=${e.statusCode} "${e.message}" → ${e.emails.length} emails: ${e.emails.join(", ")}`);
    }
  }

  return { sent, failed, skipped, errors };
}

async function sendIndividually(
  resend: Resend,
  messages: EmailMessage[],
  tag: string,
  batchNum: number,
): Promise<{ sent: number; failed: number; failedAddresses: string[] }> {
  let sent = 0;
  let failed = 0;
  const failedAddresses: string[] = [];

  for (const msg of messages) {
    try {
      const { error } = await resend.emails.send(msg);
      if (error) {
        const statusCode = (error as { statusCode?: number }).statusCode ?? 0;
        const message = (error as { message?: string }).message ?? "Unknown error";
        console.error(`[${tag}] Individual send failed for ${msg.to} — status=${statusCode} message="${message}"`);
        failedAddresses.push(msg.to);
        failed++;
      } else {
        sent++;
      }
    } catch (e: unknown) {
      const message = (e as { message?: string })?.message ?? String(e);
      console.error(`[${tag}] Individual send threw for ${msg.to} — message="${message}"`);
      failedAddresses.push(msg.to);
      failed++;
    }
  }

  console.log(`[${tag}] Batch ${batchNum} individual fallback: ${sent} sent, ${failed} failed${failedAddresses.length > 0 ? ` — bad addresses: ${failedAddresses.join(", ")}` : ""}`);
  return { sent, failed, failedAddresses };
}
