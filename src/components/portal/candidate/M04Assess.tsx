"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExamChoice, SubjectScore } from "@/lib/database.types";

interface SessionRow {
  id: string;
  status: "checked_in" | "in_progress" | "submitted" | "expired";
  expires_at: string | null;
}

interface Question {
  id: string;
  subject: string;
  prompt: string;
  choices: ExamChoice[];
  points: number;
}

interface ResultRow {
  subject_scores: SubjectScore[];
  total_score: number;
  max_score: number;
  passed: boolean;
}

function useCountdown(expiresAt: string | null) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) {
      setRemainingMs(null);
      return;
    }
    const tick = () => setRemainingMs(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remainingMs;
}

export function M04Assess() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ResultRow | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const remainingMs = useCountdown(session?.status === "in_progress" ? session.expires_at : null);

  const loadSession = useCallback(async () => {
    const res = await fetch("/api/exam/session");
    const body = await res.json();
    setLoading(false);
    if (!res.ok) return;
    setSession(body.session);
    setQuestions(body.questions ?? []);
    setResult(body.result ?? null);
    const initialAnswers: Record<string, string> = {};
    (body.answers ?? []).forEach((a: { question_id: string; selected_choice_id: string | null }) => {
      if (a.selected_choice_id) initialAnswers[a.question_id] = a.selected_choice_id;
    });
    setAnswers(initialAnswers);
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    const res = await fetch("/api/exam/submit", { method: "POST" });
    const body = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setResult({ subject_scores: body.subjectScores, total_score: body.totalScore, max_score: body.maxScore, passed: body.passed });
      setSession((s) => (s ? { ...s, status: "submitted" } : s));
    } else {
      setError(body.error ?? "Submit failed.");
    }
  }, []);

  // Auto-submit the instant the timer hits zero.
  useEffect(() => {
    if (session?.status === "in_progress" && remainingMs === 0) {
      submit();
    }
  }, [remainingMs, session?.status, submit]);

  async function startExam() {
    setStarting(true);
    setError("");
    const res = await fetch("/api/exam/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCode }),
    });
    const body = await res.json();
    setStarting(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't start the exam.");
      return;
    }
    await loadSession();
  }

  async function selectAnswer(questionId: string, choiceId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
    await fetch("/api/exam/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, selectedChoiceId: choiceId }),
    });
  }

  const timeLabel = useMemo(() => {
    if (remainingMs == null) return "";
    const totalSeconds = Math.floor(remainingMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [remainingMs]);

  if (loading) {
    return <div className="p-8 text-sm text-[#969696]">Loading…</div>;
  }

  // Results view — either an auto-graded or manually-entered result exists.
  if (result) {
    const pct = result.max_score > 0 ? Math.round((result.total_score / result.max_score) * 100) : 0;
    return (
      <div className="p-5 lg:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl p-10 shadow-elev-2 text-center" style={{ background: result.passed ? undefined : undefined }}>
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 font-heading font-extrabold text-2xl"
            style={{ background: result.passed ? "#05881215" : "#9b233515", color: result.passed ? "#058812" : "#9b2335" }}
          >
            {pct}%
          </div>
          <h2 className="font-heading font-extrabold text-2xl mb-2" style={{ color: result.passed ? "#058812" : "#9b2335" }}>
            {result.passed ? "PASSED" : "NOT PASSED"}
          </h2>
          <p className="text-sm text-[#646464] mb-6">
            {result.total_score} / {result.max_score} points
          </p>
          <div className="space-y-3 text-left">
            {result.subject_scores.map((s) => {
              const spct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0;
              return (
                <div key={s.subject}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-heading font-semibold text-[#323232]">{s.subject}</span>
                    <span className="text-[#646464]">
                      {s.score}/{s.maxScore} ({spct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#f4f4f4" }}>
                    <div className="h-2 rounded-full" style={{ width: `${spct}%`, background: spct >= 40 ? "#058812" : "#e05c00" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-5 lg:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-elev-2 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl" style={{ background: "#f4f4f4" }}>
            🖥
          </div>
          <h2 className="font-heading font-bold text-lg text-[#323232] mb-2">Not checked in yet</h2>
          <p className="text-sm text-[#646464]">
            On the day of your CBT, a Radial Circle assessment officer will check you in at the centre using your JQS Number and NIN, then give you a
            one-time access code to enter here.
          </p>
        </div>
      </div>
    );
  }

  if (session.status === "expired") {
    return (
      <div className="p-5 lg:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-elev-2 text-center">
          <h2 className="font-heading font-bold text-lg mb-2" style={{ color: "#9b2335" }}>
            Session expired
          </h2>
          <p className="text-sm text-[#646464]">Your exam window closed before it was submitted. Speak to a CBT officer at your centre.</p>
        </div>
      </div>
    );
  }

  if (session.status === "submitted") {
    return (
      <div className="p-5 lg:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-elev-2 text-center">
          <h2 className="font-heading font-bold text-lg text-[#323232] mb-2">Submitted</h2>
          <p className="text-sm text-[#646464]">Your exam has been submitted. Results will appear here once released.</p>
        </div>
      </div>
    );
  }

  if (session.status === "checked_in") {
    return (
      <div className="p-5 lg:p-8 max-w-md mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-elev-2">
          <h2 className="font-heading font-bold text-lg text-[#323232] mb-1">Enter your access code</h2>
          <p className="text-sm text-[#646464] mb-5">Your CBT officer gave you a 6-digit code at check-in. Once you start, you'll have 2 hours.</p>
          <input
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            maxLength={6}
            inputMode="numeric"
            className="input text-center text-2xl font-mono tracking-widest mb-4"
            placeholder="000000"
          />
          {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}
          <button onClick={startExam} disabled={starting || accessCode.length !== 6} className="btn-primary w-full">
            {starting ? "Starting…" : "Start Exam"}
          </button>
        </div>
      </div>
    );
  }

  // in_progress
  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto pb-24">
      <div className="sticky top-0 z-10 bg-white rounded-2xl px-6 py-4 shadow-elev-2 mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-lg text-[#323232]">CBT in progress</h2>
          <p className="text-xs text-[#969696]">{questions.length} questions</p>
        </div>
        <div className="font-heading font-extrabold text-2xl font-mono" style={{ color: remainingMs != null && remainingMs < 5 * 60 * 1000 ? "#9b2335" : "#058812" }}>
          {timeLabel}
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-elev-2 text-center">
          <p className="text-sm text-[#646464]">
            No exam questions are loaded yet — the question bank hasn&apos;t been populated for this session. Your CBT officer can enter your results
            manually once the paper/alternate assessment is complete.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-2xl p-6 shadow-elev-2">
              <div className="text-[11px] font-heading font-bold uppercase tracking-wider mb-2" style={{ color: "#969696" }}>
                {q.subject} · Q{i + 1}
              </div>
              <p className="text-sm font-heading font-semibold text-[#323232] mb-4">{q.prompt}</p>
              <div className="space-y-2">
                {q.choices.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectAnswer(q.id, c.id)}
                    className="w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-colors"
                    style={{
                      borderColor: answers[q.id] === c.id ? "#058812" : "#D8D8D8",
                      background: answers[q.id] === c.id ? "#05881208" : "white",
                      color: "#323232",
                    }}
                  >
                    {c.text}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 lg:pl-56 bg-white shadow-elev-4 p-4 flex justify-end">
        <button onClick={submit} disabled={submitting} className="btn-primary px-8">
          {submitting ? "Submitting…" : "Submit Exam"}
        </button>
      </div>
    </div>
  );
}
