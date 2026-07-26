"use client";

import { useCallback, useEffect, useState } from "react";
import { CORE_FIELDS, DEFAULT_SECTIONS, SectionSpec } from "@/lib/defaults";
import HistoryPanel from "./HistoryPanel";
import { BackupStatus, Snapshot, backupStatus, logGeneration } from "@/lib/history";

type Core = Record<string, string>;
type SectionState = { spec: SectionSpec; body: string; loading: boolean; error?: string };

const MODELS = [
  { id: "claude-sonnet-5", label: "Sonnet 5 (빠름·균형)" },
  { id: "claude-opus-4-8", label: "Opus 4.8 (최고 품질)" },
];

const LS_CORE = "grantfill.core";
const LS_KEY = "grantfill.apiKey";
const LS_MODEL = "grantfill.model";
const LS_SECTIONS = "grantfill.sections";

export default function Page() {
  const [core, setCore] = useState<Core>({});
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [sections, setSections] = useState<SectionState[]>(
    DEFAULT_SECTIONS.map((spec) => ({ spec, body: "", loading: false }))
  );
  const [runningAll, setRunningAll] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [backup, setBackup] = useState<BackupStatus | null>(null);

  // 패널을 열지 않아도 백업이 밀렸다는 건 보여야 한다 — 안 열어보는 게 실패 경로다.
  const refreshBackup = useCallback(() => {
    backupStatus()
      .then(setBackup)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!historyOpen) refreshBackup();
  }, [historyOpen, refreshBackup]);

  // load persisted state
  useEffect(() => {
    try {
      const c = localStorage.getItem(LS_CORE);
      if (c) setCore(JSON.parse(c));
      const k = localStorage.getItem(LS_KEY);
      if (k) setApiKey(k);
      const m = localStorage.getItem(LS_MODEL);
      if (m) setModel(m);
      const s = localStorage.getItem(LS_SECTIONS);
      if (s) {
        const saved: { id: string; body: string }[] = JSON.parse(s);
        setSections((prev) =>
          prev.map((sec) => {
            const hit = saved.find((x) => x.id === sec.spec.id);
            return hit ? { ...sec, body: hit.body } : sec;
          })
        );
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_CORE, JSON.stringify(core));
  }, [core, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_KEY, apiKey);
  }, [apiKey, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_MODEL, model);
  }, [model, hydrated]);
  useEffect(() => {
    if (hydrated)
      localStorage.setItem(
        LS_SECTIONS,
        JSON.stringify(sections.map((s) => ({ id: s.spec.id, body: s.body })))
      );
  }, [sections, hydrated]);

  const coreFilled = CORE_FIELDS.some((f) => (core[f.label] || "").trim().length > 0);

  async function generate(idx: number): Promise<void> {
    const sec = sections[idx];
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, loading: true, error: undefined } : s))
    );
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          core,
          sectionTitle: sec.spec.title,
          sectionBrief: sec.spec.brief,
          apiKey: apiKey || undefined,
          model,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");
      setSections((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, body: data.text, loading: false } : s))
      );
      // 이력 기록은 부수 효과다 — 실패해도 생성 자체를 막지 않는다.
      void logGeneration({
        sectionId: sec.spec.id,
        sectionTitle: sec.spec.title,
        model,
        core,
        output: data.text,
      })
        .then(refreshBackup)
        .catch(() => {});
    } catch (e: any) {
      setSections((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, loading: false, error: e.message } : s
        )
      );
    }
  }

  async function generateAll() {
    if (!coreFilled) return;
    setRunningAll(true);
    for (let i = 0; i < sections.length; i++) {
      // sequential — keeps sections consistent and avoids rate limits
      // eslint-disable-next-line no-await-in-loop
      await generate(i);
    }
    setRunningAll(false);
  }

  function updateBody(idx: number, body: string) {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, body } : s)));
  }

  function restoreSection(sectionId: string, body: string) {
    setSections((prev) =>
      prev.map((s) => (s.spec.id === sectionId ? { ...s, body } : s))
    );
  }

  function restoreSnapshot(snap: Snapshot) {
    setCore(snap.core);
    setSections((prev) =>
      prev.map((s) => {
        const hit = snap.sections.find((x) => x.id === s.spec.id);
        return hit ? { ...s, body: hit.body, error: undefined } : { ...s, body: "" };
      })
    );
  }

  function copyAll() {
    const doc = sections
      .filter((s) => s.body.trim())
      .map((s) => `## ${s.spec.title}\n\n${s.body.trim()}`)
      .join("\n\n");
    navigator.clipboard.writeText(doc);
  }

  function downloadMd() {
    const title = core["운용사 / 회사명"] || "지원서";
    const doc =
      `# ${title} — 지원서 초안\n\n` +
      sections
        .filter((s) => s.body.trim())
        .map((s) => `## ${s.spec.title}\n\n${s.body.trim()}`)
        .join("\n\n");
    const blob = new Blob([doc], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}-초안.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="wrap">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◧</span>
          <div>
            <h1>GrantFill</h1>
            <p>핵심만 쓰면, 반복은 채워집니다</p>
          </div>
        </div>
        <div className="controls">
          <input
            type="password"
            className="key"
            placeholder="Anthropic API 키 (브라우저에만 저장)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid">
        {/* LEFT — the creative core, written once */}
        <section className="core">
          <div className="panel-head">
            <h2>Core — 여기만 당신이 씁니다</h2>
            <p>모든 섹션은 아래 내용에서만 근거를 끌어옵니다. 여기 없는 사실은 지어내지 않습니다.</p>
          </div>
          {CORE_FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span className="label">{f.label}</span>
              {f.hint && <span className="hint">{f.hint}</span>}
              <textarea
                rows={f.key === "thesis" || f.key === "notes" ? 4 : 2}
                placeholder={f.placeholder}
                value={core[f.label] || ""}
                onChange={(e) =>
                  setCore((prev) => ({ ...prev, [f.label]: e.target.value }))
                }
              />
            </label>
          ))}
        </section>

        {/* RIGHT — the repetitive sections, generated from the core */}
        <section className="sections">
          <div className="panel-head sticky">
            <div>
              <h2>섹션 — 자동으로 채워집니다</h2>
              <p>{sections.filter((s) => s.body.trim()).length}/{sections.length} 작성됨</p>
            </div>
            <div className="actions">
              <button
                className="primary"
                onClick={generateAll}
                disabled={runningAll || !coreFilled}
                title={!coreFilled ? "먼저 Core를 채우세요" : ""}
              >
                {runningAll ? "생성 중…" : "전체 생성"}
              </button>
              <button onClick={copyAll}>전체 복사</button>
              <button onClick={downloadMd}>.md 저장</button>
              <button
                onClick={() => setHistoryOpen(true)}
                title={backup?.stale ? "백업하지 않은 기록이 있습니다" : ""}
              >
                이력
                {backup?.stale && <span className="dot" aria-label="백업 필요" />}
              </button>
            </div>
          </div>

          {sections.map((s, idx) => (
            <div className="card" key={s.spec.id}>
              <div className="card-head">
                <h3>{s.spec.title}</h3>
                <button
                  className="ghost"
                  onClick={() => generate(idx)}
                  disabled={s.loading || !coreFilled}
                >
                  {s.loading ? "…" : s.body ? "다시 생성" : "생성"}
                </button>
              </div>
              <p className="brief">{s.spec.brief}</p>
              {s.error && <p className="err">{s.error}</p>}
              <textarea
                className="body"
                rows={s.body ? 10 : 3}
                placeholder="‘생성’을 누르면 Core를 근거로 초안이 채워집니다. 이후 자유롭게 편집하세요."
                value={s.body}
                onChange={(e) => updateBody(idx, e.target.value)}
              />
            </div>
          ))}
        </section>
      </div>
      <footer className="foot">
        API 키와 작성 내용은 이 브라우저(localStorage)에만 저장되며 서버에 남지 않습니다.
        각 섹션은 편집 후 그대로 복사·제출용으로 쓰세요.
      </footer>

      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        core={core}
        sections={sections.map((s) => ({
          id: s.spec.id,
          title: s.spec.title,
          body: s.body,
        }))}
        onRestoreSection={restoreSection}
        onRestoreSnapshot={restoreSnapshot}
        onExported={refreshBackup}
      />
    </main>
  );
}
