/**
 * Supabase 기반 투표 서비스
 */
class VoteService {
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

  static toResults(candidate1, candidate2, candidate3) {
    return {
      candidate1,
      candidate2,
      candidate3
    };
  }

  async getCandidateCount(candidateNo) {
    const { count, error } = await this.supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_no', candidateNo);

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  async getTotalCount() {
    const { count, error } = await this.supabase
      .from('votes')
      .select('id', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  async getResults() {
    this.ensureClient();

    const [totalVotes, candidate1, candidate2, candidate3] = await Promise.all([
      this.getTotalCount(),
      this.getCandidateCount(1),
      this.getCandidateCount(2),
      this.getCandidateCount(3)
    ]);

    return {
      totalVotes,
      results: VoteService.toResults(candidate1, candidate2, candidate3),
      updatedAt: new Date().toISOString()
    };
  }

  async getMyVote(clientId) {
    this.ensureClient();
    const { data, error } = await this.supabase
      .from('votes')
      .select('id, candidate_no')
      .eq('client_id', clientId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async cancelVote(clientId) {
    this.ensureClient();
    const existing = await this.getMyVote(clientId);
    if (!existing) return { deleted: false, ...(await this.getResults()) };
    const { error } = await this.supabase.from('votes').delete().eq('id', existing.id);
    if (error) throw error;
    return { deleted: true, ...(await this.getResults()) };
  }

  async changeVote(clientId, candidate) {
    this.ensureClient();
    const existing = await this.getMyVote(clientId);
    if (!existing) {
      const err = new Error('no vote to change');
      err.code = 'NO_VOTE';
      throw err;
    }
    const { error } = await this.supabase
      .from('votes')
      .update({ candidate_no: candidate })
      .eq('id', existing.id);
    if (error) throw error;
    return { selectedCandidate: candidate, ...(await this.getResults()) };
  }

  async createVoteAndGetResults({ candidate, sessionId = null, clientId }) {
    this.ensureClient();

    const { error } = await this.supabase
      .from('votes')
      .insert({ candidate_no: candidate, session_id: sessionId, client_id: clientId });
    if (error) throw error;

    const aggregated = await this.getResults();
    return {
      ok: true,
      selectedCandidate: candidate,
      ...aggregated
    };
  }
}

module.exports = VoteService;
