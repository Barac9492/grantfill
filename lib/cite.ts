// [근거: 항목명] 태그를 읽고 지우는 도구.
//
// 태그는 작성자가 검토할 때만 쓰인다. 제출 문서에는 남으면 안 되므로
// 복사·저장 경로에서 반드시 지운다.
//
// [확인 필요: ...]는 지우지 않는다 — 그건 아직 채우지 못한 구멍이고,
// 조용히 사라지면 구멍인 채로 제출된다.

const CITE = "\\[근거:\\s*([^\\]]*)\\]";
const TODO = "\\[확인\\s*필요[^\\]]*\\]";

/** 정규식은 lastIndex를 들고 다니므로 쓸 때마다 새로 만든다. */
function re(src: string): RegExp {
  return new RegExp(src, "g");
}

/** 제출본에서 근거 태그를 걷어낸다. */
export function stripCitations(text: string): string {
  return text
    .replace(re(CITE), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/[ \t]+([.,、。])/g, "$1");
}

/** 이 본문이 근거로 든 Core 항목들 (중복 제거, 등장 순서). */
export function citedFields(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(re(CITE))) {
    for (const raw of (m[1] || "").split(",")) {
      const f = raw.trim();
      if (f && !out.includes(f)) out.push(f);
    }
  }
  return out;
}

/** 아직 메워지지 않은 [확인 필요] 개수. */
export function todoCount(text: string): number {
  return text.match(re(TODO))?.length ?? 0;
}

/** 근거 태그가 하나라도 있는지. */
export function hasCitations(text: string): boolean {
  return re(CITE).test(text);
}
