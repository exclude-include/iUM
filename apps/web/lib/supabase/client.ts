import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// 1. 싱글톤 인스턴스 생성 (한 번만 만듦)
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// 2. ChatSidebar.tsx가 찾고 있는 함수 추가
// 중요: 매번 새로 만들지 않고, 위에서 만든 인스턴스(supabase)를 반환하도록 함
// 이렇게 하면 useEffect 무한 루프도 방지됩니다.
export const createClient = () => {
  return supabase;
};