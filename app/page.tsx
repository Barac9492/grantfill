"use client";

import { useCallback, useEffect, useState } from "react";
import { CORE_FIELDS, DEFAULT_SECTIONS, SectionSpec } from "@/lib/defaults";
import HistoryPanel from "./HistoryPanel";
import { BackupStatus, Snapshot, backupStatus, logGeneration } from "@/lib/history";
import { citedFields, stripCitations, todoCount } from "@/lib/cite";

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
const LS_CITE = "grantfill.cite";

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
  const [cite, setCite] = useState(true);
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
      const ct = localStorage.getItem(LS_CITE);
      if (ct !== null) setCite(ct === "1");
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
    if (hydrated) localStorage.setItem(LS_CITE, cite ? "1" : "0");
  }, [cite, hydrated]);
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
          cite,
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

  // 근거 태그는 검토용이다 — 제출 문서로 나가는 경로에서는 걷어낸다.
  function buildDoc(): string {
    return sections
      .filter((s) => s.body.trim())
      .map((s) => `## ${s.spec.title}\n\n${stripCitations(s.body).trim()}`)
      .join("\n\n");
  }

  function copyAll() {
    navigator.clipboard.writeText(buildDoc());
  }

  function downloadMd() {
    const title = core["운용사 / 회사명"] || "지원서";
    const doc = `# ${title} — 지원서 초안\n\n` + buildDoc();
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
          <label className="toggle" title="문단마다 어떤 Core 항목을 근거로 썼는지 표시합니다. 복사·저장할 때는 빠집니다.">
            <input
              type="checkbox"
              checked={cite}
              onChange={(e) => setCite(e.target.checked)}
            />
            근거 표시
          </label>
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
              {s.body.trim() && <SourceChips body={s.body} />}
            </div>
          ))}
        </section>
      </div>
      <footer className="foot">
        API 키와 작성 내용은 이 브라우저(localStorage)에만 저장되며 서버에 남지 않습니다.
        [근거: …] 표시는 검토용이라 복사·저장할 때 자동으로 빠지고, [확인 필요]는 남습니다.
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

/** 이 섹션이 실제로 어떤 Core 항목을 근거로 삼았는지, 그리고 아직 뚫린 구멍이 몇 개인지. */
function SourceChips({ body }: { body: string }) {
  const fields = citedFields(body);
  const todos = todoCount(body);
  if (!fields.length && !todos) return null;
  return (
    <div className="cites">
      {fields.map((f) => (
        <span className="chip" key={f}>
          {f}
        </span>
      ))}
      {todos > 0 && <span className="chip warn">확인 필요 {todos}</span>}
    </div>
  );
}
