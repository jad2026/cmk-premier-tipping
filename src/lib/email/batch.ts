import { Resend } from "resend";

export type EmailMessage = { from: string; to: string; subject: string; html: string };

const MAX_BATCH_SIZE = 100;
const MAX_RETRIES = 4;

type BatchError = {
  statusCode: number;
  message: string;
  emails: string[];
};

export async function sendEmailBatch(
  messages: EmailMessage[],
  tag: string,
): Promise<{ sent: number; failed: number; errors: BatchError[] }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: 0, failed: messages.length, errors: [] };

  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;
  const errors: BatchError[] = [];

  for (let i = 0; i < messages.length; i += MAX_BATCH_SIZE) {
    const chunk = messages.slice(i, i + MAX_BATCH_SIZE);
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

        console.error(`[${tag}] Batch ${batchNum} threw — status=${statusCode} message="${message}" emails=[${batchEmails.join(", ")}]`);
        errors.push({ statusCode, message, emails: batchEmails });
        failed += chunk.length;
        break;
      }
    }
  }

  const totalBatches = Math.ceil(messages.length / MAX_BATCH_SIZE);
  console.log(`[${tag}] Batch send complete: ${sent} sent, ${failed} failed (${messages.length} total across ${totalBatches} batches)`);

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

  return { sent, failed, errors };
}
