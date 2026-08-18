"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Calendar, Flame, Footprints, Lock, Sparkles, Ticket, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import { api, apiErrorMessage } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { Assessment, DanceJourney, Student, TimelineEntry } from "@/lib/types";

const RATING_FIELDS = ["rhythm", "timing", "technique", "expression", "coordination", "performance"] as const;

export default function DanceJourneyPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const me = useQuery({ queryKey: ["students", "me"], queryFn: async () => (await api.get<Student>("/students/me")).data });
  const studentId = me.data?.id;

  const journey = useQuery({
    queryKey: ["students", studentId, "journey"],
    queryFn: async () => (await api.get<DanceJourney>(`/students/${studentId}/journey`)).data,
    enabled: !!studentId,
  });
  const timeline = useQuery({
    queryKey: ["students", studentId, "timeline"],
    queryFn: async () => (await api.get<{ entries: TimelineEntry[] }>(`/students/${studentId}/timeline`)).data.entries,
    enabled: !!studentId,
  });
  const assessments = useQuery({
    queryKey: ["students", studentId, "assessments"],
    queryFn: async () => (await api.get<Assessment[]>(`/students/${studentId}/assessments`)).data,
    enabled: !!studentId,
  });

  const logPractice = useMutation({
    mutationFn: async () => (await api.post<{ logged: boolean }>(`/students/${studentId}/practice`)).data,
    onSuccess: (data) => {
      toast.success(data.logged ? "Practice logged — keep the streak going!" : "Already logged today");
      queryClient.invalidateQueries({ queryKey: ["students", studentId, "journey"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (me.isLoading || journey.isLoading) return <Spinner />;
  if (!journey.data) return <EmptyState title="Dance journey unavailable" />;

  const j = journey.data;
  const latestAssessment = assessments.data?.[0];

  const entriesByYear = (timeline.data ?? []).reduce<Record<string, TimelineEntry[]>>((acc, entry) => {
    const year = new Date(entry.date).getFullYear().toString();
    acc[year] = acc[year] ?? [];
    acc[year].push(entry);
    return acc;
  }, {});
  const years = Object.keys(entriesByYear).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Card className="bg-gradient-to-br from-primary to-accent p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white/15 p-3">
            <Footprints className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">Your Dance Journey</p>
            <p className="text-sm text-white/80">Joined {j.joining_date} · {j.current_course ?? "Not enrolled yet"} · {j.skill_level ?? "Trial"}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBlock label="Classes Attended" value={j.classes_attended} />
          <StatBlock label="Events" value={j.events_participated} />
          <StatBlock label="Achievements" value={j.achievements.filter((a) => a.earned).length} />
          <StatBlock label="Practice Streak" value={`${j.practice_streak.current_streak_days}d`} />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gold/10 p-2.5 text-gold">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{j.practice_streak.current_streak_days} Day Practice Streak</p>
              <p className="text-xs text-muted">
                Longest: {j.practice_streak.longest_streak_days} days · {j.practice_streak.total_days_logged} total days logged
              </p>
            </div>
          </div>
          <Button size="sm" disabled={j.practice_streak.practiced_today} loading={logPractice.isPending} onClick={() => logPractice.mutate()}>
            {j.practice_streak.practiced_today ? "Logged for today" : "Log Practice Today"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {j.achievements.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border p-4 text-center ${a.earned ? "border-gold/30 bg-gold/[0.06]" : "border-border opacity-60"}`}
            >
              {a.earned ? <Award className="mx-auto h-6 w-6 text-gold" /> : <Lock className="mx-auto h-6 w-6 text-muted" />}
              <p className="mt-2 text-sm font-semibold text-foreground">{a.title}</p>
              <p className="text-[11px] text-muted">{a.description}</p>
              {a.earned && a.earned_date && <p className="mt-1 text-[10px] text-gold">{a.earned_date}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <Link href="/classes" className="text-xs font-medium text-primary hover:underline">View classes</Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-primary" /> {j.classes_attended} classes attended so far
          </div>
          {latestAssessment ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {RATING_FIELDS.map((field) => (
                <div key={field} className="text-center">
                  <p className="text-lg font-bold text-primary">{latestAssessment[field]}/5</p>
                  <p className="text-[11px] capitalize text-muted">{field}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No trainer assessment yet. Your trainer will rate your progress after class.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.isLoading && <Spinner />}
          {years.length === 0 && <EmptyState title="Your journey is just getting started" icon={Sparkles} />}
          <div className="space-y-6">
            {years.map((year) => (
              <div key={year}>
                <p className="mb-2 text-sm font-bold text-foreground">{year}</p>
                <div className="space-y-3 border-l border-border pl-4">
                  {entriesByYear[year].map((entry, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                      <p className="text-sm font-medium text-foreground">
                        {entry.link ? <Link href={entry.link} className="hover:underline">{entry.title}</Link> : entry.title}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted">
                        <Calendar className="h-3 w-3" /> {new Date(entry.date).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center pb-4">
        <Link href="/events">
          <Badge tone="primary" className="flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <Ticket className="h-3.5 w-3.5" /> Explore upcoming events
          </Badge>
        </Link>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/10 p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] text-white/80">{label}</p>
    </div>
  );
}
