class ScoreService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  ensureClient() {
    if (!this.supabase) {
      const err = new Error('supabase client is not configured');
      err.code = 'SUPABASE_NOT_CONFIGURED';
      throw err;
    }
  }

  async resolveUniqueUserId(userId) {
    const { data, error } = await this.supabase
      .from('game_scores')
      .select('user_id')
      .like('user_id', `${userId}%`);

    if (error) throw error;

    const existingIds = new Set((data || []).map(r => r.user_id));
    if (!existingIds.has(userId)) return userId;

    let n = 2;
    while (existingIds.has(`${userId}${n}`)) n++;
    return `${userId}${n}`;
  }

  async addScore({ userId, score }) {
    this.ensureClient();

    const resolvedUserId = await this.resolveUniqueUserId(userId);

    const { error } = await this.supabase
      .from('game_scores')
      .insert({ user_id: resolvedUserId, score });

    if (error) throw error;

    return resolvedUserId;
  }

  async getLeaderboard() {
    this.ensureClient();

    const { data, error } = await this.supabase
      .from('game_scores')
      .select('user_id, score');

    if (error) throw error;

    const totals = {};
    for (const row of data) {
      totals[row.user_id] = (totals[row.user_id] ?? 0) + row.score;
    }

    return Object.entries(totals)
      .map(([userId, totalScore]) => ({ userId, totalScore }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((entry, index) => ({ id: index + 1, ...entry }));
  }
}

module.exports = ScoreService;
