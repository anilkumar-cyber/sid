"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/Feedback";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
}

export default function AuditLogsPage() {
  const [entityType, setEntityType] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit-logs", { entityType }],
    queryFn: async () => (await api.get<AuditLogEntry[]>("/audit-logs", { params: { entity_type: entityType || undefined, page_size: 100 } })).data,
  });

  return (
    <div className="space-y-4">
      <Input
        className="w-64"
        placeholder="Filter by entity type (e.g. payment, student)"
        value={entityType}
        onChange={(e) => setEntityType(e.target.value)}
      />

      <Card className="overflow-x-auto">
        {isLoading && <Spinner />}
        {isError && <ErrorState />}
        {data?.length === 0 && <EmptyState title="No audit activity found" />}
        {!!data?.length && (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-black/[0.02] text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Entity ID</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-3 text-muted">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{row.action}</td>
                  <td className="px-4 py-3 capitalize text-muted">{row.entity_type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{row.entity_id ? row.entity_id.slice(0, 8) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
