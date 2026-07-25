// 줄 단위 비교. 탈락본과 재도전본이 정확히 어디서 갈리는지 보기 위한 것.

export type DiffRow = { type: "same" | "add" | "del"; text: string };

/** LCS 표가 감당 못 할 만큼 길면 통째로 교체된 것으로 본다. */
const MAX_CELLS = 4_000_000;

function split(t: string): string[] {
  return t.replace(/\r\n/g, "\n").split("\n");
}

export function diffLines(oldText: string, newText: string): DiffRow[] {
  const a = split(oldText);
  const b = split(newText);
  const n = a.length;
  const m = b.length;

  if (n * m > MAX_CELLS) {
    return [
      ...a.map((text): DiffRow => ({ type: "del", text })),
      ...b.map((text): DiffRow => ({ type: "add", text })),
    ];
  }

  // dp[i][j] = a[i..], b[j..]의 최장 공통 부분수열 길이
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: "del", text: a[i] });
      i++;
    } else {
      rows.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) rows.push({ type: "del", text: a[i++] });
  while (j < m) rows.push({ type: "add", text: b[j++] });
  return rows;
}

export function diffStat(rows: DiffRow[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const r of rows) {
    if (r.type === "add") added++;
    else if (r.type === "del") removed++;
  }
  return { added, removed };
}

/**
 * 변경된 줄만 남기고, 앞뒤 맥락 몇 줄을 붙여 접는다.
 * 바뀐 게 없으면 빈 배열.
 */
export function collapseUnchanged(rows: DiffRow[], context = 2): DiffRow[] {
  const keep = new Array<boolean>(rows.length).fill(false);
  let any = false;
  rows.forEach((r, i) => {
    if (r.type === "same") return;
    any = true;
    for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) {
      keep[k] = true;
    }
  });
  if (!any) return [];
  return rows.filter((_, i) => keep[i]);
}
