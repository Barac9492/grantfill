// 이력 저장소 — 이 브라우저 안에서만 (IndexedDB).
//
// 원래 설계(데이터베이스 없음, 브라우저에만 저장)를 그대로 지키되,
// 몇 달짜리 출자사업 사이클을 담을 만큼 오래 버티게 만든다.
//
// 두 종류의 기록:
//   - events    : 생성 1회 = 기록 1건. 추가만 되고 지워지지 않는다.
//                 "어떤 Core가, 어떤 모델로, 언제 이 문장을 만들었나"의 근거.
//   - snapshots : 문서 전체를 얼려 이름을 붙인 것 (예: "2026 1차 제출본").
//                 탈락본 ↔ 재도전본을 비교하는 단위.

export type Core = Record<string, string>;

/** 생성 1회에 대한 기록. 한 번 쌓이면 수정·삭제하지 않는다. */
export type GenEvent = {
  id: string;
  ts: number;
  sectionId: string;
  sectionTitle: string;
  model: string;
  /** 이 문장을 만들어낸 그 시점의 Core 전체 */
  core: Core;
  output: string;
};

export type SnapshotSection = { id: string; title: string; body: string };

/** 이름 붙인 제출본. 비교(diff)의 단위. */
export type Snapshot = {
  id: string;
  ts: number;
  /** 예) "2026 모태펀드 1차 제출본" */
  label: string;
  /** 예) 탈락 사유, 심사 피드백 */
  note?: string;
  core: Core;
  sections: SnapshotSection[];
};

export type Archive = {
  format: "grantfill.history";
  version: 1;
  exportedAt: number;
  events: GenEvent[];
  snapshots: Snapshot[];
};

const DB_NAME = "grantfill";
const DB_VERSION = 1;
const EVENTS = "events";
const SNAPSHOTS = "snapshots";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function historyAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!historyAvailable()) {
    return Promise.reject(new Error("이 브라우저에서는 이력 저장을 쓸 수 없습니다."));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(EVENTS)) {
        db.createObjectStore(EVENTS, { keyPath: "id" }).createIndex("ts", "ts");
      }
      if (!db.objectStoreNames.contains(SNAPSHOTS)) {
        db.createObjectStore(SNAPSHOTS, { keyPath: "id" }).createIndex("ts", "ts");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

/* ---------------------------------------------------------------- events */

/** 생성 결과를 이력에 남긴다. 실패해도 생성 자체를 막지 않는다(호출부에서 무시). */
export async function logGeneration(
  e: Omit<GenEvent, "id" | "ts">
): Promise<GenEvent> {
  const rec: GenEvent = { ...e, id: newId(), ts: Date.now() };
  await run(EVENTS, "readwrite", (s) => s.add(rec));
  return rec;
}

/** 최신순 전체 생성 이력. */
export async function listEvents(): Promise<GenEvent[]> {
  const all = await run<GenEvent[]>(EVENTS, "readonly", (s) => s.getAll());
  return all.sort((a, b) => b.ts - a.ts);
}

/* ------------------------------------------------------------- snapshots */

export async function saveSnapshot(
  s: Omit<Snapshot, "id" | "ts">
): Promise<Snapshot> {
  const rec: Snapshot = { ...s, id: newId(), ts: Date.now() };
  await run(SNAPSHOTS, "readwrite", (st) => st.add(rec));
  return rec;
}

/** 최신순 전체 스냅샷. */
export async function listSnapshots(): Promise<Snapshot[]> {
  const all = await run<Snapshot[]>(SNAPSHOTS, "readonly", (s) => s.getAll());
  return all.sort((a, b) => b.ts - a.ts);
}

/** 스냅샷은 사용자가 붙인 이름표라 지울 수 있다. 생성 이력(events)은 지우지 않는다. */
export async function deleteSnapshot(id: string): Promise<void> {
  await run(SNAPSHOTS, "readwrite", (s) => s.delete(id));
}

/* ------------------------------------------------------- export / import */

export async function exportArchive(): Promise<Archive> {
  const [events, snapshots] = await Promise.all([listEvents(), listSnapshots()]);
  return {
    format: "grantfill.history",
    version: 1,
    exportedAt: Date.now(),
    events,
    snapshots,
  };
}

/**
 * 백업 파일을 되돌린다. 같은 id는 건너뛴다 — 덮어쓰지 않는 것이 이 저장소의 규칙.
 * 다른 기기에서 export한 파일을 합칠 때도 안전하다.
 */
export async function importArchive(
  json: string
): Promise<{ events: number; snapshots: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("JSON을 읽을 수 없습니다.");
  }
  const a = parsed as Partial<Archive>;
  if (!a || a.format !== "grantfill.history") {
    throw new Error("GrantFill 백업 파일이 아닙니다.");
  }

  const db = await openDb();
  const events = Array.isArray(a.events) ? a.events : [];
  const snapshots = Array.isArray(a.snapshots) ? a.snapshots : [];

  return new Promise((resolve, reject) => {
    const tx = db.transaction([EVENTS, SNAPSHOTS], "readwrite");
    let added = { events: 0, snapshots: 0 };

    const put = (storeName: string, rec: { id: string }, key: "events" | "snapshots") => {
      // add()는 중복 id에서 실패한다 — 그게 우리가 원하는 동작(기존 기록 보존).
      const req = tx.objectStore(storeName).add(rec);
      req.onsuccess = () => {
        added[key] += 1;
      };
      req.onerror = (ev) => {
        ev.preventDefault(); // 중복은 조용히 건너뛴다
        ev.stopPropagation();
      };
    };

    for (const e of events) if (e && e.id) put(EVENTS, e, "events");
    for (const s of snapshots) if (s && s.id) put(SNAPSHOTS, s, "snapshots");

    tx.oncomplete = () => resolve(added);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
