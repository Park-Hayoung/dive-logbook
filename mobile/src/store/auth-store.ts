import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/src/services/supabase";
import { queryClient } from "@/src/lib/query-client";

type AuthState = {
  session: Session | null;
  user: User | null;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (session: Session | null) => void;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isHydrated: false,

  hydrate: async () => {
    const { data } = await supabase.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      isHydrated: true,
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.session) {
      set({ session: data.session, user: data.session.user });
    }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    set({ session: data.session, user: data.user });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
    // 다른 계정으로 갈아탈 때 이전 사용자의 데이터가 잠깐 노출되는 걸 막는다.
    queryClient.clear();
  },
}));
