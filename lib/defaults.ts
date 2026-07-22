export type CoreField = {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
};

// The "creative core" — written ONCE. Every section is generated from this.
export const CORE_FIELDS: CoreField[] = [
  {
    key: "org",
    label: "운용사 / 회사명",
    placeholder: "예) OO벤처스 (설립 20XX년, AUM XXX억원)",
  },
  {
    key: "program",
    label: "지원 사업 / 출자 프로그램",
    placeholder: "예) 2026 모태펀드 1차 정시 — 스케일업 분야",
    hint: "어느 사업의 지원서인지. 심사 기준이 여기서 갈립니다.",
  },
  {
    key: "thesis",
    label: "핵심 투자 논지 (Thesis)",
    placeholder:
      "우리만의 관점 한 문단. 왜 이 분야, 왜 지금, 왜 우리가 이길 수 있는지.",
    hint: "여기가 창의적인 부분. 나머지 섹션은 전부 이걸 근거로 생성됩니다.",
  },
  {
    key: "team",
    label: "팀 & 트랙레코드",
    placeholder:
      "대표 펀드매니저 이력, 핵심 운용인력, 주요 투자·회수 실적(회사명/배수/IRR 등).",
  },
  {
    key: "edge",
    label: "차별점 / 경쟁우위",
    placeholder: "딜소싱 채널, 포트폴리오 지원 역량, 네트워크 등 남들과 다른 점.",
  },
  {
    key: "fund",
    label: "결성 계획 (규모 · 주요 LP)",
    placeholder: "예) 목표 결성 800억원, 정부출자 240억 요청, 주요 LP: OO, OO.",
  },
  {
    key: "notes",
    label: "추가 컨텍스트 / 메모 (자유)",
    placeholder: "숫자, 고유명사, 반드시 반영할 문장 등 아무거나. 사실만.",
    hint: "여기 없는 사실은 지어내지 않습니다. 빈 곳은 [확인 필요]로 표시됩니다.",
  },
];

export type SectionSpec = {
  id: string;
  title: string;
  brief: string; // what this section must cover — steers generation
};

// The repetitive sections. Generated FROM the core, so they stay consistent.
export const DEFAULT_SECTIONS: SectionSpec[] = [
  {
    id: "overview",
    title: "운용사 개요",
    brief: "설립 배경, 조직 구성, AUM, 운용 철학을 간결하게. Thesis와 톤을 일치시킬 것.",
  },
  {
    id: "team",
    title: "핵심 운용인력 및 역량",
    brief: "대표 펀드매니저와 핵심인력의 이력·역할, 팀으로서의 강점을 논지와 연결.",
  },
  {
    id: "strategy",
    title: "투자 전략 및 중점 투자 분야",
    brief: "Thesis를 심사역이 납득할 구조로 전개. 분야 선정 근거, 투자 단계·티켓 사이즈.",
  },
  {
    id: "pipeline",
    title: "딜 소싱 및 투자 집행 계획",
    brief: "차별화된 소싱 채널, 연차별 집행 계획, 파이프라인 근거. edge를 구체화.",
  },
  {
    id: "value",
    title: "포트폴리오 밸류업 및 회수 전략",
    brief: "투자 후 지원 역량과 회수 시나리오. 트랙레코드로 뒷받침.",
  },
  {
    id: "formation",
    title: "펀드 결성 계획",
    brief: "목표 규모, 정부출자 요청 규모, LP 구성 및 결성 확실성 근거.",
  },
  {
    id: "risk",
    title: "리스크 관리 및 내부통제",
    brief: "투자·운영 리스크 식별과 통제 장치, 이해상충 방지. 담백하고 신뢰감 있게.",
  },
  {
    id: "policy",
    title: "정책 목적 부합성",
    brief: "해당 출자사업의 정책 목적을 우리 전략이 어떻게 달성하는지 정면으로 연결.",
  },
];
