import Image from "next/image";
import { CheckCircle2, XCircle, Download } from "lucide-react";

import { getCertificateByVerificationCode } from "@/features/certificates/data";

type Props = {
  params: Promise<{ code: string }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** certificates.participant_name / experience_title store the Arabic form
 * whenever the certificate was issued with one (see features/certificates/
 * actions.ts) — this page has no language toggle, so it just renders
 * whichever script the row actually contains. */
const ARABIC_PATTERN = /[؀-ۿ]/;

function arabicAwareClass(text: string): string | undefined {
  return ARABIC_PATTERN.test(text) ? "font-cairo" : undefined;
}

export default async function VerifyCertificatePage({ params }: Props) {
  const { code } = await params;
  const certificate = await getCertificateByVerificationCode(code);

  return (
    <main className="flex min-h-screen items-center justify-center bg-night px-4 py-12 text-ivory">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image src="/emg/logo-dark.png" alt="Enable My Growth" width={220} height={55} className="h-auto w-44" />
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-elevated p-8 text-center shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
          {!certificate && (
            <>
              <XCircle className="mx-auto size-12 text-muted-foreground" />
              <h1 className="mt-4 text-xl font-semibold text-ivory">Certificate not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We couldn&apos;t find a certificate matching this verification code.
              </p>
            </>
          )}

          {certificate?.status === "revoked" && (
            <>
              <XCircle className="mx-auto size-12 text-destructive" />
              <h1 className="mt-4 text-xl font-semibold text-ivory">This certificate has been revoked</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {certificate.revokedAt
                  ? `Revoked on ${formatDate(certificate.revokedAt)}.`
                  : "This certificate is no longer valid."}
              </p>
            </>
          )}

          {certificate?.status === "issued" && (
            <>
              <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">
                <CheckCircle2 className="size-4" />
                Verified
              </div>

              <h1 className={`mt-4 text-2xl font-semibold text-ivory ${arabicAwareClass(certificate.participantName) ?? ""}`}>
                {certificate.participantName}
              </h1>
              <p className="mt-1 text-muted-foreground">has successfully completed</p>
              <p className={`mt-1 text-lg font-medium text-gold ${arabicAwareClass(certificate.experienceTitle) ?? ""}`}>
                {certificate.experienceTitle}
              </p>

              <dl className="mt-6 space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <dt>Issued by</dt>
                  <dd className="text-ivory">{certificate.organizationName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Completion date</dt>
                  <dd className="text-ivory">{formatDate(certificate.completionDate)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Issued on</dt>
                  <dd className="text-ivory">{formatDate(certificate.issuedAt)}</dd>
                </div>
              </dl>

              <a
                href={certificate.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-night hover:bg-gold/90"
              >
                <Download className="size-4" />
                Download Certificate
              </a>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
