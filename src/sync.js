export async function saveToCloud(supabase, userId, state) {
  try {
    const basePayload = {
      user_id: userId,
      platforms: state.platforms,
      roles: state.roles,
      global_config: state.globalConfig,
      projects: state.projects,
      templates: state.templates,
      updated_at: new Date().toISOString(),
    };
    const extendedPayload = {
      ...basePayload,
      people: state.people,
      point_records: state.pointRecords,
      production_progress: state.productionProgress,
    };
    let { data, error } = await supabase
      .from('user_data')
      .upsert(extendedPayload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error && error.code === '42703') {
      const fallback = await supabase
        .from('user_data')
        .upsert(basePayload, { onConflict: 'user_id' })
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) return { data: null, error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function loadFromCloud(supabase, userId) {
  try {
    let { data, error } = await supabase
      .from('user_data')
      .select('platforms, roles, global_config, projects, templates, people, point_records, production_progress')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code === '42703') {
      const fallback = await supabase
        .from('user_data')
        .select('platforms, roles, global_config, projects, templates')
        .eq('user_id', userId)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) return { data: null, error };
    if (!data) return { data: null, error: null };

    return {
      data: {
        platforms: data.platforms,
        roles: data.roles,
        globalConfig: data.global_config,
        projects: data.projects,
        templates: Array.isArray(data.templates) ? data.templates : null,
        people: Array.isArray(data.people) ? data.people : null,
        pointRecords: Array.isArray(data.point_records) ? data.point_records : null,
        productionProgress: data.production_progress && typeof data.production_progress === 'object'
          ? data.production_progress
          : null,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err };
  }
}
