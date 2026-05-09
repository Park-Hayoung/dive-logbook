// Diving-themed Korean nickname generator. Picks a random adjective + sea
// creature combination, with an occasional 2-digit suffix for uniqueness.
//
// Examples: 푸른돌고래, 신비한문어42, 빛나는해파리, 용감한범고래7

import { supabase } from "@/src/services/supabase";

const ADJECTIVES = [
  "푸른",
  "하얀",
  "깊은",
  "잔잔한",
  "빛나는",
  "신비한",
  "용감한",
  "자유로운",
  "빠른",
  "느긋한",
  "수줍은",
  "활기찬",
  "차분한",
  "따뜻한",
  "시원한",
  "반짝이는",
  "유쾌한",
  "당당한",
  "고요한",
  "통통한",
  "재빠른",
  "꿈꾸는",
  "춤추는",
  "헤엄치는",
  "씩씩한",
] as const;

const CREATURES = [
  "돌고래",
  "거북이",
  "가오리",
  "문어",
  "해마",
  "산호",
  "불가사리",
  "청새치",
  "해달",
  "펭귄",
  "만타",
  "고래",
  "해파리",
  "정어리",
  "오징어",
  "랍스터",
  "범고래",
  "꽃게",
  "전복",
  "복어",
  "흰동가리",
  "쥐가오리",
  "고래상어",
  "물개",
  "다이버",
  "인어",
  "잠수부",
  "해녀",
] as const;

const pick = <T>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)] as T;

export function randomNickname(): string {
  const adj = pick(ADJECTIVES);
  const creature = pick(CREATURES);
  // ~30% chance to append a 1–99 number for uniqueness in case of collision.
  const suffix = Math.random() < 0.3 ? `${Math.floor(Math.random() * 99) + 1}` : "";
  return `${adj}${creature}${suffix}`;
}

// Generate a nickname that isn't already taken in the profiles table.
// Generates a batch of candidates locally, then asks Supabase in a single
// round-trip which ones are already in use, and picks one of the survivors.
// If all candidates collide (very unlikely) or the DB call fails, falls back
// to appending a 4-digit suffix so the user is never shown a known-taken name.
export async function randomAvailableNickname(): Promise<string> {
  const BATCH = 8;
  const candidates = Array.from({ length: BATCH }, () => randomNickname());

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("nickname")
      .in("nickname", candidates);
    if (error) throw error;
    const taken = new Set((data ?? []).map((r) => r.nickname as string));
    const free = candidates.find((c) => !taken.has(c));
    if (free) return free;
  } catch {
    // Network/permission failure → fall through to suffixed fallback.
  }

  const base = randomNickname().replace(/\d+$/, "");
  return `${base}${Math.floor(Math.random() * 9000) + 1000}`;
}
