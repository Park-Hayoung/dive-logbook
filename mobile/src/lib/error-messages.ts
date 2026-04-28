// Translates errors from Supabase / network / storage into user-friendly
// Korean messages. Falls back to a generic friendly message when nothing
// recognizable is found.
//
// Usage:
//   } catch (err) {
//     Alert.alert("저장 실패", friendlyError(err));
//   }

type ErrorLike = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  details?: unknown;
};

const FALLBACK = "잠시 후 다시 시도해주세요. 문제가 계속되면 관리자에게 문의해주세요.";

// Each rule: a substring (case-insensitive) of the raw message, mapped to a
// friendly Korean replacement. First match wins, so put more specific entries
// first.
const PATTERNS: { match: string; friendly: string }[] = [
  // ── Auth (Supabase Auth gotrue) ─────────────────────────────────────────
  {
    match: "user already registered",
    friendly: "이미 가입된 이메일이에요. 로그인 화면에서 시도해주세요.",
  },
  {
    match: "invalid login credentials",
    friendly: "이메일 또는 비밀번호가 올바르지 않아요.",
  },
  {
    match: "email not confirmed",
    friendly: "이메일 인증이 아직 완료되지 않았어요.",
  },
  {
    match: "email rate limit exceeded",
    friendly: "요청이 너무 잦아요. 잠시 후 다시 시도해주세요.",
  },
  {
    match: "password should be at least",
    friendly: "비밀번호가 너무 짧아요.",
  },
  {
    match: "weak_password",
    friendly: "비밀번호가 너무 약해요. 더 복잡하게 설정해주세요.",
  },
  {
    match: "user not found",
    friendly: "해당 계정을 찾을 수 없어요.",
  },

  // ── Storage ─────────────────────────────────────────────────────────────
  {
    match: "bucket not found",
    friendly: "저장소가 아직 준비되지 않았어요. 관리자에게 문의해주세요.",
  },
  {
    match: "the resource was not found",
    friendly: "파일을 찾을 수 없어요.",
  },
  {
    match: "payload too large",
    friendly: "파일 용량이 너무 커요.",
  },

  // ── Database / PostgREST ────────────────────────────────────────────────
  {
    match: "profiles_nickname_key",
    friendly: "이미 사용 중인 닉네임이에요. 다른 닉네임으로 시도해주세요.",
  },
  {
    match: "duplicate key value violates unique constraint",
    friendly: "이미 등록된 항목이에요.",
  },
  {
    match: "violates row-level security policy",
    friendly: "이 작업을 수행할 권한이 없어요.",
  },
  {
    match: "permission denied",
    friendly: "이 작업을 수행할 권한이 없어요.",
  },
  {
    match: "infinite recursion detected in policy",
    friendly:
      "데이터베이스 권한 설정에 문제가 있어요. 관리자에게 문의해주세요.",
  },
  {
    match: "violates foreign key constraint",
    friendly: "연결된 데이터를 찾을 수 없어요.",
  },
  {
    match: "violates check constraint",
    friendly: "입력값이 허용 범위를 벗어났어요.",
  },
  {
    match: "value too long for type",
    friendly: "입력값이 너무 길어요.",
  },
  {
    match: "null value in column",
    friendly: "필수 항목이 비어있어요.",
  },

  // ── Network ─────────────────────────────────────────────────────────────
  {
    match: "network request failed",
    friendly: "네트워크 연결을 확인해주세요.",
  },
  {
    match: "fetch failed",
    friendly: "네트워크 연결을 확인해주세요.",
  },
  {
    match: "timeout",
    friendly: "응답이 지연되고 있어요. 다시 시도해주세요.",
  },
  {
    match: "abort",
    friendly: "요청이 취소되었어요.",
  },

  // ── JWT / session ───────────────────────────────────────────────────────
  {
    match: "jwt expired",
    friendly: "로그인 세션이 만료됐어요. 다시 로그인해주세요.",
  },
  {
    match: "invalid jwt",
    friendly: "인증 정보가 올바르지 않아요. 다시 로그인해주세요.",
  },
  {
    match: "not authenticated",
    friendly: "로그인이 필요해요.",
  },
  {
    match: "missing bearer token",
    friendly: "로그인이 필요해요.",
  },
];

function rawMessageOf(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message ?? "";
  if (typeof err === "object") {
    const e = err as ErrorLike;
    if (typeof e.message === "string") return e.message;
    if (typeof e.details === "string") return e.details;
  }
  return "";
}

export function friendlyError(err: unknown): string {
  const raw = rawMessageOf(err).toLowerCase().trim();
  if (!raw) return FALLBACK;
  for (const { match, friendly } of PATTERNS) {
    if (raw.includes(match)) return friendly;
  }
  // Unknown error — return raw if it looks short enough to be readable in
  // Korean / English, otherwise fall back to the generic message.
  const original = rawMessageOf(err).trim();
  if (original.length > 0 && original.length <= 80) return original;
  return FALLBACK;
}
