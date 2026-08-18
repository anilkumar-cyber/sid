"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { useParams } from "next/navigation";

import { api, apiErrorMessage } from "@/lib/api";

interface CertificateOut {
  id: string;
  student_id: string;
  certificate_number: string;
  achievement_type: string;
  title: string;
  issued_date: string;
  verification_code: string;
}

export default function VerifyCertificatePage() {
  const { code } = useParams<{ code: string }>();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["certificate-verify", code],
    queryFn: async () => (await api.get<CertificateOut>(`/certificates/verify/${code}`)).data,
    retry: false,
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm text-muted">Sid Bollywood Certificate Verification</p>

        {isLoading && <p className="mt-8 text-sm text-muted">Checking...</p>}

        {isError && (
          <div className="mt-8 space-y-2">
            <XCircle className="mx-auto h-10 w-10 text-danger" />
            <p className="font-semibold text-foreground">Not a valid certificate</p>
            <p className="text-sm text-muted">{apiErrorMessage(error, "This verification code was not found.")}</p>
          </div>
        )}

        {data && (
          <div className="mt-8 space-y-3">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <div className="flex items-center justify-center gap-2">
              <Award className="h-5 w-5 text-gold" />
              <p className="text-lg font-bold text-foreground">{data.title}</p>
            </div>
            <p className="text-sm capitalize text-muted">{data.achievement_type.replace(/_/g, " ")}</p>
            <div className="rounded-xl bg-black/[0.03] p-4 text-left text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted">Certificate No.</span>
                <span className="font-medium text-foreground">{data.certificate_number}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">Issued</span>
                <span className="font-medium text-foreground">{data.issued_date}</span>
              </div>
            </div>
            <p className="text-xs text-success">This certificate is genuine and was issued by Sid Bollywood.</p>
          </div>
        )}
      </div>
    </div>
  );
}
