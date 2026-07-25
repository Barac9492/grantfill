"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Core,
  GenEvent,
  Snapshot,
  SnapshotSection,
  deleteSnapshot,
  exportArchive,
  importArchive,
  listEvents,
  listSnapshots,
  saveSnapshot,
} from "@/lib/history";
import { collapseUnchanged, diffLines, diffStat } from "@/lib/diff";

type Props = {
  open: boolean;
  onClose: () => void;
  core: Core;
  sections: SnapshotSection[];
  onRestoreSection: (sectionId: string, body: string) => void;
  onRestoreSnapshot: (snap: Snapshot) => void;
};

const CURRENT = "__current__";

function fmt(ts: number): string {
  return new Date(ts).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPanel({
  open,
  onClose,
  core,
  sections,
  onRestoreSection,
  onRestoreSnapshot,
}: Props) {
  const [tab, setTab] = useState<"snapshots" | "events">("snapshots");
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [events, setEvents] = useState<GenEvent[]>([]);
  const [err, setErr] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [baseId, setBaseId] = useState("");
  const [targetId, setTargetId] = useState(CURRENT);
  const [openEvent, setOpenEvent] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([listSnapshots(), listEvents()]);
      setSnaps(s);
      setEvents(e);
      setBaseId((prev) => prev || (s.length ? s[0].id : ""));
    } catch (e: any) {
      setErr(e?.message || "이력을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const written = useMemo(
    () => sections.filter((s) => s.body.trim()).length,
    [sections]
  );

  async function onSave() {
    const name = label.trim();
    if (!name) return;
    try {
      await saveSnapshot({
        label: name,
        note: note.trim() || undefined,
        core,
        sections: sections.map((s) => ({ ...s })),
      });
      setLabel("");
      setNote("");
      setErr("");
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "저장에 실패했습니다.");
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`스냅샷 "${name}"을 지울까요? 생성 기록은 그대로 남습니다.`)) return;
    await deleteSnapshot(id);
    if (baseId === id) setBaseId("");
    if (targetId === id) setTargetId(CURRENT);
    await refresh();
  }

  async function onExport() {
    const archive = await exportArchive();
    const blob = new Blob([JSON.stringify(archive, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const d = new Date().toISOString().slice(0, 10);
    a.download = `grantfill-history-${d}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImportFile(file: File) {
    try {
      const added = await importArchive(await file.text());
      setErr("");
      await refresh();
      alert(
        `불러왔습니다 — 생성 기록 ${added.events}건, 스냅샷 ${added.snapshots}건 추가.\n(이미 있는 기록은 건너뜁니다.)`
      );
    } catch (e: any) {
      setErr(e?.message || "불러오기에 실패했습니다.");
    }
  }

  /* --------------------------------------------------------------- diff */

  const base = snaps.find((s) => s.id === baseId) || null;
  const target: { label: string; sections: SnapshotSection[] } | null =
    targetId === CURRENT
      ? { label: "현재 작업본", sections }
      : snaps.find((s) => s.id === targetId) || null;

  const comparison = useMemo(() => {
    if (!base || !target) return null;
    const ids: string[] = [];
    for (const s of target.sections) ids.push(s.id);
    for (const s of base.sections) if (!ids.includes(s.id)) ids.push(s.id);

    return ids.map((id) => {
      const a = base.sections.find((s) => s.id === id);
      const b = target.sections.find((s) => s.id === id);
      const rows = diffLines(a?.body || "", b?.body || "");
      return {
        id,
        title: b?.title || a?.title || id,
        rows: collapseUnchanged(rows),
        stat: diffStat(rows),
      };
    });
  }, [base, target]);

  const changedCount = comparison?.filter((c) => c.rows.length > 0).length ?? 0;

  if (!open) return null;

  return (
    <div className="hs-overlay" onMouseDown={onClose}>
      <div
        className="hs-panel"
        role="dialog"
        aria-modal="true"
        aria-label="이력"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="hs-head">
          <div className="hs-tabs">
            <button
              className={tab === "snapshots" ? "on" : ""}
              onClick={() => setTab("snapshots")}
            >
              스냅샷 <span className="hs-count">{snaps.length}</span>
            </button>
            <button
              className={tab === "events" ? "on" : ""}
              onClick={() => setTab("events")}
            >
              생성 기록 <span className="hs-count">{events.length}</span>
            </button>
          </div>
          <div className="hs-head-actions">
            <button className="ghost" onClick={onExport}>
              내보내기 .json
            </button>
            <button className="ghost" onClick={() => fileRef.current?.click()}>
              불러오기
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.target.value = "";
              }}
            />
            <button className="ghost" onClick={onClose}>
              닫기
            </button>
          </div>
        </header>

        {err && <p className="err hs-pad">{err}</p>}

        {tab === "snapshots" && (
          <div className="hs-body">
            <div className="hs-save">
              <div className="hs-save-row">
                <input
                  className="hs-input"
                  placeholder="제출본 이름 — 예) 2026 모태펀드 1차 제출본"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <button className="primary" onClick={onSave} disabled={!label.trim()}>
                  현재 상태 저장
                </button>
              </div>
              <textarea
                rows={2}
                placeholder="메모 (선택) — 예) 1차 탈락 사유: 트랙레코드 귀속 불명확, 포트폴리오 구성 근거 부족"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <p className="hs-hint">
                지금 Core와 섹션 {written}/{sections.length}개가 그대로 얼어붙습니다. 제출 직전마다 한 번씩.
              </p>
            </div>

            {snaps.length === 0 ? (
              <p className="hs-empty">
                아직 스냅샷이 없습니다. 제출 직전에 하나 저장해 두면, 다음 라운드에서 무엇을 고쳤는지 줄 단위로 비교할 수 있습니다.
              </p>
            ) : (
              <>
                <ul className="hs-list">
                  {snaps.map((s) => (
                    <li key={s.id} className="hs-item">
                      <div className="hs-item-main">
                        <strong>{s.label}</strong>
                        <span className="hs-meta">
                          {fmt(s.ts)} · 섹션 {s.sections.filter((x) => x.body.trim()).length}개
                        </span>
                        {s.note && <p className="hs-note">{s.note}</p>}
                      </div>
                      <div className="hs-item-actions">
                        <button
                          className="ghost"
                          onClick={() => {
                            if (
                              confirm(
                                `"${s.label}" 내용으로 현재 작업본을 덮어씁니다. 계속할까요?\n(지금 상태를 남기려면 먼저 스냅샷을 저장하세요.)`
                              )
                            ) {
                              onRestoreSnapshot(s);
                              onClose();
                            }
                          }}
                        >
                          불러오기
                        </button>
                        <button className="ghost" onClick={() => onDelete(s.id, s.label)}>
                          삭제
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="hs-compare">
                  <h3>비교</h3>
                  <div className="hs-compare-controls">
                    <select value={baseId} onChange={(e) => setBaseId(e.target.value)}>
                      {snaps.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <span className="hs-arrow">→</span>
                    <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                      <option value={CURRENT}>현재 작업본</option>
                      {snaps.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {comparison && (
                      <span className="hs-meta">
                        {changedCount === 0
                          ? "달라진 섹션 없음"
                          : `${changedCount}개 섹션이 달라졌습니다`}
                      </span>
                    )}
                  </div>

                  {comparison?.map((c) =>
                    c.rows.length === 0 ? null : (
                      <div className="hs-diff" key={c.id}>
                        <div className="hs-diff-head">
                          <strong>{c.title}</strong>
                          <span className="hs-meta">
                            <span className="hs-add">+{c.stat.added}</span>{" "}
                            <span className="hs-del">−{c.stat.removed}</span>
                          </span>
                        </div>
                        <pre className="hs-diff-body">
                          {c.rows.map((r, i) => (
                            <div key={i} className={`hs-row hs-${r.type}`}>
                              <span className="hs-sign">
                                {r.type === "add" ? "+" : r.type === "del" ? "−" : " "}
                              </span>
                              {r.text || " "}
                            </div>
                          ))}
                        </pre>
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "events" && (
          <div className="hs-body">
            {events.length === 0 ? (
              <p className="hs-empty">
                아직 생성 기록이 없습니다. 섹션을 생성하면 어떤 Core가 그 문장을 만들었는지 여기 남습니다.
              </p>
            ) : (
              <ul className="hs-list">
                {events.map((e) => {
                  const isOpen = openEvent === e.id;
                  return (
                    <li key={e.id} className="hs-item hs-event">
                      <div className="hs-item-main">
                        <button
                          className="hs-disclose"
                          onClick={() => setOpenEvent(isOpen ? null : e.id)}
                        >
                          <span className="hs-caret">{isOpen ? "▾" : "▸"}</span>
                          <strong>{e.sectionTitle}</strong>
                          <span className="hs-meta">
                            {fmt(e.ts)} · {e.model}
                          </span>
                        </button>
                        {!isOpen && <p className="hs-preview">{e.output.slice(0, 140)}…</p>}
                        {isOpen && (
                          <div className="hs-event-detail">
                            <h4>생성된 본문</h4>
                            <pre className="hs-pre">{e.output}</pre>
                            <h4>이 문장의 근거가 된 Core</h4>
                            <dl className="hs-core">
                              {Object.entries(e.core)
                                .filter(([, v]) => v && v.trim())
                                .map(([k, v]) => (
                                  <div key={k}>
                                    <dt>{k}</dt>
                                    <dd>{v}</dd>
                                  </div>
                                ))}
                            </dl>
                            <button
                              className="ghost"
                              onClick={() => {
                                onRestoreSection(e.sectionId, e.output);
                                onClose();
                              }}
                            >
                              이 내용으로 되돌리기
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <footer className="hs-foot">
          이력도 이 브라우저에만 저장됩니다(IndexedDB). 백업하려면 <b>내보내기</b>로 파일을 받아 두세요.
        </footer>
      </div>
    </div>
  );
}
