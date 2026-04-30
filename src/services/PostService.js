class PostService {
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

  async createPost({ nickname, content }) {
    this.ensureClient();

    const { data, error } = await this.supabase
      .from('posts')
      .insert({ nickname, content })
      .select('id, nickname, content, created_at')
      .single();

    if (error) throw error;

    return data;
  }

  async getPosts() {
    this.ensureClient();

    const { data, error } = await this.supabase
      .from('posts')
      .select('id, nickname, content, created_at')
      .order('id', { ascending: true });

    if (error) throw error;

    return data;
  }
}

module.exports = PostService;
