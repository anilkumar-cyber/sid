"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ErrorState, Spinner } from "@/components/ui/Feedback";
import { api } from "@/lib/api";
import type { Student } from "@/lib/types";

export default function ProfileRedirectPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["students", "me"],
    queryFn: async () => (await api.get<Student>("/students/me")).data,
  });

  useEffect(() => {
    if (data) router.replace(`/students/${data.id}`);
  }, [data, router]);

  if (isError) return <ErrorState message="Could not load your profile." />;
  return <Spinner label="Loading your profile..." />;
}
