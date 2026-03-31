(function (global) {
  function toMillis(value) {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function sortLeaderboardRows(rows) {
    return [...rows].sort((a, b) => {
      if ((b.score ?? 0) !== (a.score ?? 0)) {
        return (b.score ?? 0) - (a.score ?? 0);
      }
      if ((a.duration_seconds ?? 0) !== (b.duration_seconds ?? 0)) {
        return (a.duration_seconds ?? 0) - (b.duration_seconds ?? 0);
      }
      return toMillis(a.created_at) - toMillis(b.created_at);
    });
  }

  function findInsertedEntryRank(rows, entryId) {
    const index = rows.findIndex((row) => row.id === entryId);
    return index === -1 ? null : index + 1;
  }

  function formatLeaderboardRows(rows, limit) {
    return sortLeaderboardRows(rows).slice(0, limit);
  }

  global.LeaderboardUtils = {
    sortLeaderboardRows,
    findInsertedEntryRank,
    formatLeaderboardRows
  };
})(typeof window !== "undefined" ? window : globalThis);
