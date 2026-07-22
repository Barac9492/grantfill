import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  core: Record<string, string>;
  sectionTitle: string;
  sectionBrief: string;
  apiKey?: string;
  model?: string;
};

const SYSTEM = `당신은 한국 정부 출자사업(모태펀드 등) GP 지원서를 다듬는 전문 작성 보조자입니다.

핵심 원칙:
1. 아래 "Core"는 지원자가 직접 쓴 창의적 핵심입니다. 모든 섹션은 이 Core에서만 근거를 끌어와야 합니다.
2. Core에 없는 사실(숫자, 고유명사, 실적)은 절대 지어내지 마세요. 필요한데 없으면 그 자리에 정확히 [확인 필요: 무엇이 필요한지] 라고 표기하세요.
3. 여러 섹션이 하나의 Thesis에서 일관되게 흘러나오도록, 논지·톤·핵심 표현을 유지하세요.
4. 심사역이 읽는 공식 문서입니다. 과장·미사여구·빈 형용사를 빼고, 구체적이고 담백하게 쓰세요.
5. 출력은 해당 섹션 본문만. 제목·머리말·설명·마크다운 코드펜스 없이 바로 본문을 한국어로 작성하세요.`;

function buildCore(core: Record<string, string>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(core)) {
    if (v && v.trim()) lines.push(`- ${k}: ${v.trim()}`);
  }
  return lines.join("\n") || "(비어 있음)";
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim() || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Anthropic API 키가 필요합니다. 상단에 키를 입력하거나 서버에 ANTHROPIC_API_KEY를 설정하세요." },
      { status: 401 }
    );
  }
  if (!body.sectionTitle) {
    return Response.json({ error: "섹션 정보가 없습니다." }, { status: 400 });
  }

  const model = body.model || "claude-sonnet-5";
  const client = new Anthropic({ apiKey });

  const userPrompt = `# Core (지원자가 쓴 창의적 핵심 — 유일한 사실 출처)
${buildCore(body.core || {})}

# 작성할 섹션
제목: ${body.sectionTitle}
이 섹션이 다뤄야 할 내용: ${body.sectionBrief}

위 Core만을 근거로 이 섹션의 본문을 작성하세요. Core에 없는 사실은 [확인 필요: ...]로 표시하세요.`;

  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return Response.json({ text });
  } catch (err: any) {
    const message =
      err?.error?.error?.message || err?.message || "생성 중 오류가 발생했습니다.";
    const status = err?.status || 500;
    return Response.json({ error: message }, { status });
  }
}
