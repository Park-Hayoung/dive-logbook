import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/src/services/supabase";

// 024_board.sql 의 board_report_reason enum 과 1:1 대응.
export type BoardReportReason =
  | "spam"
  | "sexual"
  | "violence"
  | "harassment"
  | "misinformation"
  | "copyright"
  | "other";

export const BOARD_REPORT_REASONS: {
  value: BoardReportReason;
  label: string;
}[] = [
  { value: "spam", label: "광고/스팸" },
  { value: "sexual", label: "음란/성적" },
  { value: "violence", label: "폭력/혐오" },
  { value: "harassment", label: "괴롭힘/모욕" },
  { value: "misinformation", label: "허위/기만" },
  { value: "copyright", label: "저작권" },
  { value: "other", label: "기타" },
];

// Supabase Postgres 의 unique_violation = 23505. 동일 사용자가 동일 글/댓글을 다시 신고하면 발생.
const UNIQUE_VIOLATION_CODE = "23505";

export class DuplicateReportError extends Error {
  constructor() {
    super("이미 신고하신 글/댓글이에요.");
    this.name = "DuplicateReportError";
  }
}

export type ReportInput = {
  reason: BoardReportReason;
  detail?: string | null;
};

export function useReportBoardPost(currentUserId: string | undefined) {
  return useMutation({
    mutationFn: async (input: ReportInput & { postId: string }) => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");
      const { error } = await supabase.from("board_post_reports").insert({
        post_id: input.postId,
        reporter_id: currentUserId,
        reason: input.reason,
        detail: input.detail ?? null,
      });
      if (error) {
        if (error.code === UNIQUE_VIOLATION_CODE) {
          throw new DuplicateReportError();
        }
        throw new Error(error.message || JSON.stringify(error));
      }
    },
  });
}

export function useReportBoardComment(currentUserId: string | undefined) {
  return useMutation({
    mutationFn: async (input: ReportInput & { commentId: string }) => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");
      const { error } = await supabase.from("board_comment_reports").insert({
        comment_id: input.commentId,
        reporter_id: currentUserId,
        reason: input.reason,
        detail: input.detail ?? null,
      });
      if (error) {
        if (error.code === UNIQUE_VIOLATION_CODE) {
          throw new DuplicateReportError();
        }
        throw new Error(error.message || JSON.stringify(error));
      }
    },
  });
}
