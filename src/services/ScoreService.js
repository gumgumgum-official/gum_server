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

  async addScore({ userId, score }) {
    this.ensureClient();

    const { data: existing, error: existingError } = await this.supabase
      .from('game_scores')
      .select('user_id')
      .eq('user_id', userId)
      .limit(1);

    if (existingError) throw existingError;
    if (existing && existing.length > 0) {
      const err = new Error('userId already exists');
      err.code = 'DUPLICATE_USER_ID';
      throw err;
    }

    const { error } = await this.supabase
      .from('game_scores')
      .insert({ user_id: userId, score });

    if (error) throw error;

    return userId;
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
