import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const enabled = process.env.RUN_SUPABASE_INTEGRATION_TESTS === "1";
const suite = enabled ? describe : describe.skip;

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase de staging não configurado.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function login(emailEnv: string, passwordEnv: string) {
  const email = process.env[emailEnv];
  const password = process.env[passwordEnv];
  if (!email || !password) throw new Error(`Credenciais de staging ausentes: ${emailEnv}/${passwordEnv}`);
  const supabase = client();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data: membership, error: membershipError } = await supabase.from("memberships").select("tenant_id,role").limit(1).single();
  if (membershipError) throw membershipError;
  return { supabase, membership };
}

suite("RLS multi-tenant de staging", () => {
  it("impede que usuários consultem tenant e memberships de outra empresa", async () => {
    const [a, b] = await Promise.all([
      login("TEST_TENANT_A_EMAIL", "TEST_TENANT_A_PASSWORD"),
      login("TEST_TENANT_B_EMAIL", "TEST_TENANT_B_PASSWORD"),
    ]);
    expect(a.membership.tenant_id).not.toBe(b.membership.tenant_id);

    const [{ data: tenantBFromA }, { data: tenantAFromB }, { data: membersBFromA }] = await Promise.all([
      a.supabase.from("tenants").select("id").eq("id", b.membership.tenant_id),
      b.supabase.from("tenants").select("id").eq("id", a.membership.tenant_id),
      a.supabase.from("memberships").select("id").eq("tenant_id", b.membership.tenant_id),
    ]);
    expect(tenantBFromA).toEqual([]);
    expect(tenantAFromB).toEqual([]);
    expect(membersBFromA).toEqual([]);
  });

  it("não libera recursos de outro tenant por consulta forçada", async () => {
    const [a, b] = await Promise.all([
      login("TEST_TENANT_A_EMAIL", "TEST_TENANT_A_PASSWORD"),
      login("TEST_TENANT_B_EMAIL", "TEST_TENANT_B_PASSWORD"),
    ]);
    const { data } = await a.supabase.from("employees").select("id").eq("tenant_id", b.membership.tenant_id).limit(5);
    expect(data).toEqual([]);
  });
});
