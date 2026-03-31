(function (global) {
  function createLeaderboardClient(options) {
    const config = {
      supabaseUrl: options?.supabaseUrl ?? "",
      supabaseAnonKey: options?.supabaseAnonKey ?? "",
      tableName: options?.tableName ?? "game_scores"
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
        async submitScore() {
          throw new Error("Supabase is not configured");
        },
        async fetchScores() {
          throw new Error("Supabase is not configured");
        }
      };
    }

    if (!global.supabase?.createClient) {
      return {
        enabled: false,
        reason: "sdk-missing",
        async submitScore() {
          throw new Error("Supabase SDK not loaded");
        },
        async fetchScores() {
          throw new Error("Supabase SDK not loaded");
        }
      };
    }

    const client = global.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const columns = "id,user_id,player_name,score,duration_seconds,captured_husband_count,created_at";

    return {
      enabled: true,
      reason: "",
      async submitScore(payload) {
        const { data, error } = await client
          .from(config.tableName)
          .insert(payload)
          .select("id,created_at")
          .single();

        if (error) {
          throw error;
        }

        return data;
      },
      async fetchScores() {
        const pageSize = 1000;
        const allRows = [];
        let from = 0;

        while (true) {
          const to = from + pageSize - 1;
          const { data, error } = await client
            .from(config.tableName)
            .select(columns)
            .order("score", { ascending: false })
            .order("duration_seconds", { ascending: true })
            .order("created_at", { ascending: true })
            .range(from, to);

          if (error) {
            throw error;
          }

          const rows = data ?? [];
          allRows.push(...rows);
          if (rows.length < pageSize) {
            break;
          }
          from += pageSize;
        }

        return allRows;
      },
      async fetchTopScores(limit = 15) {
        const safeLimit = Math.max(1, Math.min(100, limit));
        const { data, error } = await client
          .from(config.tableName)
          .select(columns)
          .order("score", { ascending: false })
          .order("duration_seconds", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(safeLimit);

        if (error) {
          throw error;
        }

        return data ?? [];
      }
    };
  }

  global.LeaderboardClient = {
    createLeaderboardClient
  };
})(typeof window !== "undefined" ? window : globalThis);
