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
  Cell
} from "recharts";

type Row = Record<string, any>;

const SHEET_ID = "1scqI8Kdz7VKLP9933Q-J3rqOCNgUaYFOT1nqsNwqIWk"; // 너가 준 ID
const GID = "0";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

function splitMulti(v: any) {
  if (!v) return [];
  return String(v)
    .split(/,|;|\/|\|/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// 헤더가 "Q1. 소속"처럼 조금 달라도 자동으로 찾아서 매칭
function findKey(sample: Row, includes: string[]) {
  const keys = Object.keys(sample || {});
  return keys.find((k) => includes.some((s) => k.includes(s)));
}

function glassCard(extra = "") {
  return `rounded-2xl border border-white/20 bg-white/15 backdrop-blur-xl shadow-xl ${extra}`;
}

export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setErr(null);

    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setRows((res.data as Row[]).filter(Boolean));
        setLoading(false);
      },
      error: (e) => {
        setErr(String(e));
        setLoading(false);
      }
    });
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 60_000);
    return () => clearInterval(t);
  }, []);

  const computed = useMemo(() => {
    if (!rows.length) {
      return {
        total: 0,
        newCount: 0,
        oldCount: 0,
        toolBar: [] as any[],
        majorPie: [] as any[],
        conversion: [] as any[]
      };
    }

    const sample = rows[0];

    // 컬럼 자동 탐색(너 폼 이름이 정확히 안 맞아도 되게)
    const keyAff = findKey(sample, ["Q1", "소속"]);
    const keyMajor = findKey(sample, ["Q3", "전공"]);
    const keyUse = findKey(sample, ["Q4", "대화형", "사용"]);
    const keyPaid = findKey(sample, ["Q5", "유료", "결제"]);

    const isNew = (v: any) => String(v || "").includes("신입");
    const isOld = (v: any) => String(v || "").includes("기존");

    let newCount = 0;
    let oldCount = 0;

    const majorCount: Record<string, number> = {};
    const useNew: Record<string, number> = {};
    const useOld: Record<string, number> = {};
    const paidCount: Record<string, number> = {};
    const useCount: Record<string, number> = {};

    for (const r of rows) {
      const aff = keyAff ? r[keyAff] : "";
      const major = keyMajor ? String(r[keyMajor] || "").trim() : "";
      const uses = keyUse ? splitMulti(r[keyUse]) : [];
      const paids = keyPaid ? splitMulti(r[keyPaid]) : [];

      const group = isNew(aff) ? "new" : isOld(aff) ? "old" : "unknown";
      if (group === "new") newCount++;
      if (group === "old") oldCount++;

      const m = major || "미응답";
      majorCount[m] = (majorCount[m] || 0) + 1;

      for (const tool of uses.length ? uses : ["미응답"]) {
        useCount[tool] = (useCount[tool] || 0) + 1;
        if (group === "new") useNew[tool] = (useNew[tool] || 0) + 1;
        if (group === "old") useOld[tool] = (useOld[tool] || 0) + 1;
      }

      for (const tool of paids) {
        paidCount[tool] = (paidCount[tool] || 0) + 1;
      }
    }

    const tools = Array.from(new Set(Object.keys(useCount)));

    const toolBar = tools.map((tool) => ({
      tool,
      신입: useNew[tool] || 0,
      기존: useOld[tool] || 0
    }));

    const majorPie = Object.entries(majorCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const conversion = tools
      .map((tool) => {
        const users = useCount[tool] || 0;
        const paid = paidCount[tool] || 0;
        const rate = users > 0 ? Math.round((paid / users) * 1000) / 10 : 0;
        return { tool, users, paid, rate };
      })
      .sort((a, b) => b.rate - a.rate);

    return {
      total: rows.length,
      newCount,
      oldCount,
      toolBar,
      majorPie,
      conversion
    };
  }, [rows]);

  return (
    <main
      className="min-h-screen p-6 md:p-10 text-white"
      style={{
        background:
          "linear-gradient(135deg, rgb(67,56,202), rgb(168,85,247), rgb(236,72,153))"
      }}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className={`${glassCard("p-6")} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}>
          <div>
            <h1 className="text-3xl font-bold">KPC AI Dashboard</h1>
            <p className="text-white/80">Google Sheets CSV 자동 연동 (60초 갱신)</p>
            <p className="text-white/60 text-sm break-all">{CSV_URL}</p>
          </div>
          <button
            onClick={fetchData}
            className="rounded-xl bg-white/20 px-4 py-2 hover:bg-white/30 transition active:scale-[0.99]"
          >
            지금 새로고침
          </button>
        </div>

        {(loading || err) && (
          <div className={`${glassCard("p-4")}`}>
            {loading && <div>불러오는 중…</div>}
            {err && <div className="text-red-200">에러: {err}</div>}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className={`${glassCard("p-5 hover:-translate-y-0.5 transition")}`}>
            <div className="text-white/70">총 응답자 수</div>
            <div className="text-4xl font-extrabold">{computed.total}</div>
          </div>
          <div className={`${glassCard("p-5 hover:-translate-y-0.5 transition")}`}>
            <div className="text-white/70">신입사원</div>
            <div className="text-4xl font-extrabold">{computed.newCount}</div>
          </div>
          <div className={`${glassCard("p-5 hover:-translate-y-0.5 transition")}`}>
            <div className="text-white/70">기존직원</div>
            <div className="text-4xl font-extrabold">{computed.oldCount}</div>
          </div>
        </div>

        <div className={`${glassCard("p-6")} space-y-3`}>
          <h2 className="text-xl font-bold">대화형 AI 사용 (신입 vs 기존)</h2>
          <div className="h-[360px]">
            <ResponsiveContainer>
              <BarChart data={computed.toolBar}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="tool" tick={{ fill: "white" }} />
                <YAxis tick={{ fill: "white" }} />
                <Tooltip />
                <Bar dataKey="신입" />
                <Bar dataKey="기존" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className={`${glassCard("p-6")} space-y-3`}>
            <h2 className="text-xl font-bold">전공 분포 (상위 10)</h2>
            <div className="h-[360px]">
              <ResponsiveContainer>
                <PieChart>
                  <Tooltip />
                  <Pie data={computed.majorPie} dataKey="value" nameKey="name" outerRadius={120} label>
                    {computed.majorPie.map((_, i) => (
                      <Cell key={i} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${glassCard("p-6")} space-y-3`}>
            <h2 className="text-xl font-bold">AI 도구별 유료 전환율</h2>
            <div className="space-y-3">
              {computed.conversion.map((c) => (
                <div key={c.tool} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{c.tool}</span>
                    <span className="text-white/80">
                      {c.paid}/{c.users} · {c.rate}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full bg-white/60" style={{ width: `${Math.min(100, c.rate)}%` }} />
                  </div>
                </div>
              ))}
              {!computed.conversion.length && (
                <div className="text-white/70">데이터가 아직 없거나 헤더가 달라서 집계가 0일 수 있음.</div>
              )}
            </div>
          </div>
        </div>

        <div className={`${glassCard("p-5")} text-white/80 text-sm`}>
          구글시트에 응답이 추가되면 60초 뒤 자동 반영됨(또는 “지금 새로고침”).
        </div>
      </div>
    </main>
  );
}
