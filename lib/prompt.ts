// 모델에게 주는 지시문. route에서 떼어 두어야 손으로 읽고 시험할 수 있다.

export type Core = Record<string, string>;

/**
 * "Core에서만 근거를 끌어온다"는 원칙은 원래 지시문 안에만 있었다 — 결과물만 보고는
 * 지켜졌는지 알 수 없었다. cite를 켜면 그 근거가 문장 옆에 남아, 심사역이 물었을 때
 * 바로 짚을 수 있다.
 */
export function buildSystem(cite: boolean): string {
  const rules = [
    `1. 아래 "Core"는 지원자가 직접 쓴 창의적 핵심입니다. 모든 섹션은 이 Core에서만 근거를 끌어와야 합니다.`,
    `2. Core에 없는 사실(숫자, 고유명사, 실적)은 절대 지어내지 마세요. 필요한데 없으면 그 자리에 정확히 [확인 필요: 무엇이 필요한지] 라고 표기하세요.`,
    `3. 여러 섹션이 하나의 Thesis에서 일관되게 흘러나오도록, 논지·톤·핵심 표현을 유지하세요.`,
    `4. 심사역이 읽는 공식 문서입니다. 과장·미사여구·빈 형용사를 빼고, 구체적이고 담백하게 쓰세요.`,
  ];
  if (cite) {
    rules.push(
      `5. 각 문단 끝에 그 문단이 근거로 삼은 Core 항목을 [근거: 항목명] 형식으로 붙이세요. 항목명은 Core에 적힌 이름을 그대로 쓰고, 여러 개면 쉼표로 구분합니다. Core에서 끌어온 내용이 없는 문단에는 붙이지 마세요.`
    );
  }
  rules.push(
    `${rules.length + 1}. 출력은 해당 섹션 본문만. 제목·머리말·설명·마크다운 코드펜스 없이 바로 본문을 한국어로 작성하세요.`
  );
  return `당신은 한국 정부 출자사업(모태펀드 등) GP 지원서를 다듬는 전문 작성 보조자입니다.

핵심 원칙:
${rules.join("\n")}`;
}

export function buildCore(core: Core): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(core)) {
    if (v && v.trim()) lines.push(`- ${k}: ${v.trim()}`);
  }
  return lines.join("\n") || "(비어 있음)";
}

export function buildUserPrompt(opts: {
  core: Core;
  sectionTitle: string;
  sectionBrief: string;
  cite: boolean;
}): string {
  return `# Core (지원자가 쓴 창의적 핵심 — 유일한 사실 출처)
${buildCore(opts.core)}

# 작성할 섹션
제목: ${opts.sectionTitle}
이 섹션이 다뤄야 할 내용: ${opts.sectionBrief}

위 Core만을 근거로 이 섹션의 본문을 작성하세요. Core에 없는 사실은 [확인 필요: ...]로 표시하세요.${
    opts.cite ? "\n각 문단 끝에는 [근거: 항목명]을 붙이세요." : ""
  }`;
}
