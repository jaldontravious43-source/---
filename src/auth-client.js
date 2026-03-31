(function (global) {
  const DEFAULT_PROFILE_TABLE = "player_profiles";

  function normalizePhoneNumber(raw) {
    const text = String(raw ?? "").trim();
    if (!text) return "";

    let cleaned = text.replace(/[\s\-()]/g, "");
    cleaned = cleaned.replace(/[^\d+]/g, "");

    if (cleaned.startsWith("+")) {
      const digits = cleaned.slice(1).replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) return "";
      return `+${digits}`;
    }

    const digitsOnly = cleaned.replace(/\D/g, "");

    if (/^1\d{10}$/.test(digitsOnly)) {
      return `+86${digitsOnly}`;
    }

    if (/^86\d{11}$/.test(digitsOnly)) {
      return `+${digitsOnly}`;
    }

    if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
      return `+${digitsOnly}`;
    }

    return "";
  }

  function validateNickname(name) {
    const value = String(name ?? "").trim();
    if (!value) {
      return { ok: false, message: "昵称不能为空", value };
    }
    if (value.length > 12) {
      return { ok: false, message: "昵称最多 12 字符", value };
    }
    return { ok: true, message: "", value };
  }

  function maskPhoneNumber(phone) {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) return "";
    if (normalized.length <= 8) return normalized;

    const prefix = normalized.slice(0, Math.min(6, normalized.length - 4));
    const suffix = normalized.slice(-4);
    return `${prefix}****${suffix}`;
  }

  function createAuthClient(options) {
    const config = {
      supabaseUrl: options?.supabaseUrl ?? "",
      supabaseAnonKey: options?.supabaseAnonKey ?? "",
      profileTable: options?.profileTable ?? DEFAULT_PROFILE_TABLE
    };

    const hasConfig =
      config.supabaseUrl &&
      config.supabaseAnonKey &&
      !config.supabaseUrl.includes("REPLACE_WITH") &&
      !config.supabaseAnonKey.includes("REPLACE_WITH");

    if (!hasConfig) {
      return {
        enabled: false,
        reason: "missing-config",
        async sendOtp() {
          throw new Error("Supabase 配置缺失");
        },
        async verifyOtp() {
          throw new Error("Supabase 配置缺失");
        },
        async getSession() {
          return null;
        },
        async signOut() {},
        async getProfile() {
          return null;
        },
        async upsertProfile() {
          throw new Error("Supabase 配置缺失");
        }
      };
    }

    if (!global.supabase?.createClient) {
      return {
        enabled: false,
        reason: "sdk-missing",
        async sendOtp() {
          throw new Error("Supabase SDK 未加载");
        },
        async verifyOtp() {
          throw new Error("Supabase SDK 未加载");
        },
        async getSession() {
          return null;
        },
        async signOut() {},
        async getProfile() {
          return null;
        },
        async upsertProfile() {
          throw new Error("Supabase SDK 未加载");
        }
      };
    }

    const client = global.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    return {
      enabled: true,
      reason: "",
      async sendOtp(phone) {
        const normalized = normalizePhoneNumber(phone);
        if (!normalized) {
          throw new Error("手机号格式不正确");
        }

        const { error } = await client.auth.signInWithOtp({
          phone: normalized
        });
        if (error) throw error;
        return { phone: normalized };
      },
      async verifyOtp(phone, token) {
        const normalized = normalizePhoneNumber(phone);
        const code = String(token ?? "").trim();
        if (!normalized) {
          throw new Error("手机号格式不正确");
        }
        if (!code) {
          throw new Error("验证码不能为空");
        }

        const { data, error } = await client.auth.verifyOtp({
          phone: normalized,
          token: code,
          type: "sms"
        });
        if (error) throw error;
        return data;
      },
      async getSession() {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data?.session ?? null;
      },
      async signOut() {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      },
      async getProfile(userId) {
        if (!userId) return null;
        const { data, error } = await client
          .from(config.profileTable)
          .select("id,nickname,created_at,updated_at")
          .eq("id", userId)
          .maybeSingle();
        if (error) throw error;
        return data ?? null;
      },
      async upsertProfile(userId, nickname) {
        if (!userId) {
          throw new Error("用户未登录");
        }
        const check = validateNickname(nickname);
        if (!check.ok) {
          throw new Error(check.message);
        }

        const payload = {
          id: userId,
          nickname: check.value,
          updated_at: new Date().toISOString()
        };
        const { data, error } = await client
          .from(config.profileTable)
          .upsert(payload, { onConflict: "id" })
          .select("id,nickname,created_at,updated_at")
          .single();
        if (error) throw error;
        return data;
      }
    };
  }

  global.AuthClient = {
    normalizePhoneNumber,
    validateNickname,
    maskPhoneNumber,
    createAuthClient
  };
})(typeof window !== "undefined" ? window : globalThis);
