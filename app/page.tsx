"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const SHEET_ID = "1scqI8Kdz7VKLP9933Q-J3rqOCNgUaYFOT1nqsNwqIWk";
const GID = "1225653054";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

type Row = Record<string, string>;

function normalize(str: string) {
  return (str || "").trim();
}

function pick(row: Row, keys: string[]) {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function splitMulti(v: string) {
  if (!v) return [];
  return v
    .split(/[,/|;]|·|•|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string>("");

  async function load() {
    setErr("");
    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      const text = await res.text();

      // 구글이 권한 막으면 CSV 대신 HTML이 내려오는 경우가 많음
      if (text.startsWith("<!DOCTYPE html") || text.includes("<html")) {
        throw new Error("Google Sheets 공개(링크 공개) 설정이 아직 안 된 것 같아. CSV가 아니라 HTML이 내려왔어.");
      }

      const parsed = Papa.parse<Row>(text, {
        header: true,
        skipEmptyLines: true,
      });

      const data = (parsed.data || []).filter(Boolean);
      setRows(data);
    } catch (e: any) {
      setErr(e?.message ?? "알 수 없는 오류");
      setRows([]);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // 60초마다 자동 갱신
    return () => clearInterval(t);
  }, []);

  // 컬럼명은 설문마다 다를 수 있어서 “후보 키”를 여러 개 둠
  const affiliationKeyCandidates = ["Q1. 소속", "소속", "신입/기존", "구분"];
  const majorKeyCandidates = ["Q3. 전공", "전공", "학과"];
  const aiUseKeyCandidates = ["Q4. 대화형 AI 사용 (복수선택)", "대화형 AI 사용", "AI 사용", "사용 도구"];
  const aiPaidKeyCandidates = ["Q5. 대화형 AI 유료 결제 (복수선택)", "유료 결제", "결제 도구", "Paid"];

  const total = rows.length;

  const newCount = useMemo(() => {
    return rows.filter((r) => {
      const v = normalize(pick(r, affiliationKeyCandidates));
      return v.includes("신입");
    }).length;
  }, [rows]);

  const existingCount = total - newCount;

  const aiTools = ["ChatGPT", "Claude", "Gemini", "Copilot", "Perplexity"];

  const barData = useMemo(() => {
    const counts: Record<string, { 신입: number; 기존: number }> = {};
    aiTools.forEach((t) => (counts[t] = { 신입: 0, 기존: 0 }));

    rows.forEach((r) => {
      const group = normalize(pick(r, affiliationKeyCandidates)).includes("신입") ? "신입" : "기존";
      const used = splitMulti(pick(r, aiUseKeyCandidates));
      aiTools.forEach((tool) => {
        if (used.some((x) => x.toLowerCase().includes(tool.toLowerCase()))) {
          counts[tool][group] += 1;
        }
      });
    });

    return aiTools.map((tool) => ({
      tool,
      신입: counts[tool].신입,
      기존: counts[tool].기존,
    }));
  }, [rows]);

  const majorPie = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      const major = normalize(pick(r, majorKeyCandidates)) || "미기입";
      m[major] = (m[major] || 0) + 1;
    });
    return Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [rows]);

  const conversion = useMemo(() => {
    // 유료 전환율 = (유료결제 응답자 수 / 사용 응답자 수)
    const usedCount: Record<string, number> = {};
    const paidCount: Record<string, number> = {};
    aiTools.forEach((t) => {
      usedCount[t] = 0;
      paidCount[t] = 0;
    });

    rows.forEach((r) => {
      const used = splitMulti(pick(r, aiUseKeyCandidates));
      const paid = splitMulti(pick(r, aiPaidKeyCandidates));

      aiTools.forEach((tool) => {
        if (used.some((x) => x.toLowerCase().includes(tool.toLowerCase()))) usedCount[tool] += 1;
        if (paid.some((x) => x.toLowerCase().includes(tool.toLowerCase()))) paidCount[tool] += 1;
      });
    });

    return aiTools.map((tool) => {
      const u = usedCount[tool];
      const p = paidCount[tool];
      const rate = u === 0 ? 0 : Math.round((p / u) * 100);
      return { tool, used: u, paid: p, rate };
    });
  }, [rows]);

  const colors = ["#a78bfa", "#60a5fa", "#34d399", "#fbbf24", "#fb7185", "#94a3b8", "#22c55e", "#f97316", "#38bdf8", "#e879f9"];

  return (
    <div style={{ minHeight: "100vh", padding: 24, background: "linear-gradient(135deg,#4f46e5,#a855f7,#ec4899)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "white", marginBottom: 6 }}>KPC AI Dashboard</h1>
        <div style={{ color: "rgba(255,255,255,0.9)", marginBottom: 16 }}>
          Google Sheets CSV 자동 연동 (60초 갱신) ·{" "}
          <a href={CSV_URL} target="_blank" rel="noreferrer" style={{ color: "white", textDecoration: "underline" }}>
            CSV 링크 확인
          </a>{" "}
          · <button onClick={load} style={{ marginLeft: 8, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.15)", color: "white", cursor: "pointer" }}>
            지금 새로고침
          </button>
        </div>

        {err && (
          <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.2)", color: "white", marginBottom: 16 }}>
            에러: {err}
          </div>
        )}

        {/* 요약 카드 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            { label: "총 응답자 수", value: total },
            { label: "신입사원", value: newCount },
            { label: "기존직원", value: existingCount },
          ].map((c) => (
            <div key={c.label} style={{ padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.25)", color: "white" }}>
              <div style={{ opacity: 0.9, marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* 차트들 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {/* 막대 차트 */}
          <div style={{ padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.25)" }}>
            <h2 style={{ color: "white", fontWeight: 800, marginBottom: 12 }}>대화형 AI 사용 (신입 vs 기존)</h2>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="tool" stroke="#fff" />
                  <YAxis stroke="#fff" />
                  <Tooltip />
                  <Bar dataKey="신입" />
                  <Bar dataKey="기존" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 파이 차트 */}
          <div style={{ padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.25)" }}>
            <h2 style={{ color: "white", fontWeight: 800, marginBottom: 12 }}>전공 분포 (상위 10)</h2>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={majorPie} dataKey="value" nameKey="name" outerRadius={110} label>
                    {majorPie.map((_, i) => (
                      <Cell key={i} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 전환율 바 */}
          <div style={{ padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.25)" }}>
            <h2 style={{ color: "white", fontWeight: 800, marginBottom: 12 }}>AI 도구별 유료 전환율</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {conversion.map((c) => (
                <div key={c.tool} style={{ color: "white" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ fontWeight: 700 }}>{c.tool}</div>
                    <div style={{ opacity: 0.9 }}>{c.rate}% ({c.paid}/{c.used})</div>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
                    <div style={{ width: `${c.rate}%`, height: "100%", background: "rgba(255,255,255,0.75)" }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, color: "rgba(255,255,255,0.85)", fontSize: 12 }}>
              데이터가 아직 없거나 헤더가 다르면 집계가 0일 수 있음. (시트 응답 추가 후 자동 반영 / “지금 새로고침”)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
