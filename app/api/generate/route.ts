import Anthropic from "@anthropic-ai/sdk";
import { buildSystem, buildUserPrompt } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  core: Record<string, string>;
  sectionTitle: string;
  sectionBrief: string;
  apiKey?: string;
  model?: string;
  /** 문단마다 [근거: 항목명]을 붙일지. 기본값 true. */
  cite?: boolean;
};

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
  const cite = body.cite !== false;
  const client = new Anthropic({ apiKey });

  const userPrompt = buildUserPrompt({
    core: body.core || {},
    sectionTitle: body.sectionTitle,
    sectionBrief: body.sectionBrief,
    cite,
  });

  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 1500,
      system: buildSystem(cite),
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
