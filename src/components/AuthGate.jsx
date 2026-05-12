import { useEffect, useRef, useState } from 'react';
import supabase from '../supabase';
import useStore from '../store';
import { getWriteAccess, loadLegacyUserData, loadOrgContext, loadOrgData, saveOrgData, saveToCloud } from '../sync';

function applyCloudData(data, setters) {
  if (!data) return;
  if (data.platforms) setters.setPlatforms(data.platforms);
  if (data.roles) setters.setRoles(data.roles);
  if (data.globalConfig) setters.setGlobalConfig(data.globalConfig);
  if (data.projects) setters.setProjects(data.projects);
  if (Array.isArray(data.templates)) setters.setTemplates(data.templates);
  if (Array.isArray(data.people)) setters.setPeople(data.people);
  if (Array.isArray(data.pointRecords)) setters.setPointRecords(data.pointRecords);
  if (data.productionProgress) setters.setProductionProgress(data.productionProgress);
}

const AUTH_INIT_TIMEOUT_MS = 4000;
const DATA_LOAD_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, errorMessage) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const [syncStatus, setSyncStatus] = useState('idle');
  const [dataError, setDataError] = useState('');

  const platforms = useStore((s) => s.platforms);
  const roles = useStore((s) => s.roles);
  const globalConfig = useStore((s) => s.globalConfig);
  const projects = useStore((s) => s.projects);
  const templates = useStore((s) => s.templates);
  const people = useStore((s) => s.people);
  const pointRecords = useStore((s) => s.pointRecords);
  const productionProgress = useStore((s) => s.productionProgress);
  const orgContext = useStore((s) => s.orgContext);
  const setPlatforms = useStore((s) => s.setPlatforms);
  const setRoles = useStore((s) => s.setRoles);
  const setGlobalConfig = useStore((s) => s.setGlobalConfig);
  const setProjects = useStore((s) => s.setProjects);
  const setTemplates = useStore((s) => s.setTemplates);
  const setPeople = useStore((s) => s.setPeople);
  const setPointRecords = useStore((s) => s.setPointRecords);
  const setProductionProgress = useStore((s) => s.setProductionProgress);
  const setOrgContext = useStore((s) => s.setOrgContext);
  const setDepartments = useStore((s) => s.setDepartments);
  const setOrganizationMembers = useStore((s) => s.setOrganizationMembers);
  const setOrganizationInvites = useStore((s) => s.setOrganizationInvites);
  const resetStore = useStore((s) => s.resetStore);

  const debounceRef = useRef(null);
  const userIdRef = useRef(null);
  const loadSeqRef = useRef(0);

  const loadUserData = async (sessionUser) => {
    const loadSeq = loadSeqRef.current + 1;
    loadSeqRef.current = loadSeq;
    setDataReady(false);
    setDataError('');
    setSyncStatus('loading');
    const contextResult = await withTimeout(
      loadOrgContext(supabase, sessionUser),
      DATA_LOAD_TIMEOUT_MS,
      '组织信息读取超时，请刷新页面或退出后重试。'
    ).catch((err) => ({ data: null, error: err }));
    if (loadSeq !== loadSeqRef.current) return;
    if (contextResult.error) {
      setDataError(contextResult.error.message || '加载组织信息失败，请稍后刷新重试。');
      setSyncStatus('error');
      return;
    }
    const context = contextResult.data;

    if (context.legacyMode) {
      const legacyResult = await withTimeout(
        loadLegacyUserData(supabase, sessionUser.id),
        DATA_LOAD_TIMEOUT_MS,
        '云端数据读取超时，请刷新页面或退出后重试。'
      ).catch((err) => ({ data: null, error: err }));
      if (loadSeq !== loadSeqRef.current) return;
      if (legacyResult.error) {
        setDataError(legacyResult.error.message || '加载云端数据失败，请稍后刷新重试。');
        setSyncStatus('error');
        return;
      }
      resetStore();
      setOrgContext(context);
      if (legacyResult.data) {
        applyCloudData(legacyResult.data, { setPlatforms, setRoles, setGlobalConfig, setProjects, setTemplates, setPeople, setPointRecords, setProductionProgress });
      }
      setDepartments([]);
      setOrganizationMembers([]);
      setOrganizationInvites([]);
      setMessage('');
      setSyncStatus(legacyResult.data ? 'saved' : 'idle');
      userIdRef.current = sessionUser.id;
      setDataReady(true);
      return;
    }

    const { data, error } = await withTimeout(
      loadOrgData(supabase, context.organization.id, context.member),
      DATA_LOAD_TIMEOUT_MS,
      '云端数据读取超时，请刷新页面或退出后重试。'
    ).catch((err) => ({ data: null, error: err }));
    if (loadSeq !== loadSeqRef.current) return;
    if (error) {
      setDataError(error.message || '加载云端数据失败，请稍后刷新重试。');
      setSyncStatus('error');
      return;
    } else {
      if (data?.state) {
        resetStore();
        setOrgContext(context);
        applyCloudData(data.state, { setPlatforms, setRoles, setGlobalConfig, setProjects, setTemplates, setPeople, setPointRecords, setProductionProgress });
        setDepartments(data.departments || []);
        setOrganizationMembers(data.members || []);
        setOrganizationInvites(data.invites || []);
      } else {
        resetStore();
        setOrgContext(context);
      }
      setMessage('');
      setSyncStatus(data ? 'saved' : 'idle');
    }
    userIdRef.current = sessionUser.id;
    setDataReady(true);
  };

  const activateSession = async (sessionUser) => {
    setUser(sessionUser);
    setAuthReady(true);
    await loadUserData(sessionUser);
  };

  useEffect(() => {
    let alive = true;
    let fallbackTimer = null;

    fallbackTimer = setTimeout(() => {
      if (!alive) return;
      setMessage('登录状态检查超时，请重新登录。');
      setAuthReady(true);
    }, AUTH_INIT_TIMEOUT_MS);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!alive) return;
        clearTimeout(fallbackTimer);
        if (session?.user) {
          activateSession(session.user);
        } else {
          setAuthReady(true);
        }
      })
      .catch(() => {
        if (!alive) return;
        clearTimeout(fallbackTimer);
        setMessage('登录状态检查失败，请重新登录。');
        setAuthReady(true);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') {
        loadSeqRef.current += 1;
        setUser(session?.user || null);
        setMode('reset');
        setDataReady(false);
        setAuthReady(true);
      } else if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(() => {
          if (alive) activateSession(session.user);
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        loadSeqRef.current += 1;
        userIdRef.current = null;
        resetStore();
        setOrgContext(null);
        setUser(null);
        setDataReady(false);
        setDataError('');
        setSyncStatus('idle');
        setAuthReady(true);
      }
    });

    return () => {
      alive = false;
      clearTimeout(fallbackTimer);
      listener.subscription.unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user || !dataReady || userIdRef.current !== user.id || !orgContext?.organization?.id) return;
    const access = getWriteAccess(orgContext.member);
    if (!access.canWriteGlobal) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSyncStatus('syncing');
    debounceRef.current = setTimeout(async () => {
      const payload = {
        platforms,
        roles,
        globalConfig,
        projects,
        templates,
        people,
        pointRecords,
        productionProgress,
        departments: useStore.getState().departments,
      };
      const { error } = orgContext.legacyMode
        ? await saveToCloud(supabase, user.id, payload)
        : await saveOrgData(supabase, orgContext.organization.id, payload);
      setSyncStatus(error ? 'error' : 'saved');
    }, 1200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [platforms, roles, globalConfig, projects, templates, people, pointRecords, productionProgress, user, dataReady, orgContext]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (mode !== 'reset' && !trimmedEmail) return;
    if ((mode === 'login' || mode === 'register') && password.length < 6) {
      setMessage('密码至少需要 6 位。');
      return;
    }
    setLoading(true);
    setMessage('');

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      setLoading(false);
      if (error) {
        setMessage('邮箱或密码不正确，或账号尚未完成邮箱验证。');
      }
      return;
    }

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { team_name: teamName.trim() },
        },
      });
      setLoading(false);
      if (error) {
        setMessage(error.message || '注册失败，请稍后重试。');
        return;
      }
      setSent(true);
      return;
    }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin,
      });
      setLoading(false);
      if (error) {
        setMessage(error.message || '发送重置邮件失败。');
        return;
      }
      setSent(true);
      return;
    }

    if (mode === 'reset') {
      if (newPassword.length < 6) {
        setLoading(false);
        setMessage('新密码至少需要 6 位。');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      setLoading(false);
      if (error) {
        setMessage(error.message || '更新密码失败。');
        return;
      }
      setMessage('密码已更新，请重新登录。');
      setNewPassword('');
      await supabase.auth.signOut();
      setMode('login');
      return;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!authReady) {
    return (
      <div className="auth-page">
        <div className="auth-panel">
          <div className="auth-title">制作成本核算器</div>
          <div className="auth-sub">正在检查登录状态...</div>
        </div>
      </div>
    );
  }

  if (!user || mode === 'reset') {
    const isReset = mode === 'reset';
    const isForgot = mode === 'forgot';
    return (
      <div className="auth-page">
        <form className="auth-panel" onSubmit={handleSubmit}>
          <div>
            <div className="auth-title">{isReset ? '设置新密码' : '制作成本核算器'}</div>
            <div className="auth-sub">
              {isReset
                ? '请输入新密码。更新完成后，用邮箱和新密码重新登录。'
                : '注册时完成邮箱验证；之后可直接用邮箱和密码登录，账号数据会自动云端同步。'}
            </div>
          </div>

          {!isReset && (
            <div className="auth-tabs">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setSent(false); setMessage(''); }}>
                登录
              </button>
              <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setSent(false); setMessage(''); }}>
                注册
              </button>
            </div>
          )}

          {!sent ? (
            <>
              {!isReset && (
                <div className="fld">
                  <label>邮箱</label>
                  <input type="email" value={email} placeholder="name@company.com" autoComplete="email" onChange={e => setEmail(e.target.value)} />
                </div>
              )}
              {(mode === 'login' || mode === 'register') && (
                <div className="fld">
                  <label>密码</label>
                  <input type="password" value={password} placeholder="至少 6 位" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onChange={e => setPassword(e.target.value)} />
                </div>
              )}
              {isReset && (
                <div className="fld">
                  <label>新密码</label>
                  <input type="password" value={newPassword} placeholder="至少 6 位" autoComplete="new-password" onChange={e => setNewPassword(e.target.value)} />
                </div>
              )}
              {mode === 'register' && (
                <div className="fld">
                  <label>团队名称</label>
                  <input value={teamName} placeholder="Gleam Studio" onChange={e => setTeamName(e.target.value)} />
                </div>
              )}
              <button className="auth-submit" type="submit" disabled={loading}>
                {loading
                  ? '处理中...'
                  : mode === 'login'
                    ? '登录'
                    : mode === 'register'
                      ? '注册并发送验证邮件'
                      : isForgot
                        ? '发送重置邮件'
                        : '更新密码'}
              </button>
              {mode === 'login' && (
                <button type="button" className="auth-link" onClick={() => { setMode('forgot'); setSent(false); setMessage(''); }}>
                  忘记密码？
                </button>
              )}
              {mode === 'forgot' && (
                <button type="button" className="auth-link" onClick={() => { setMode('login'); setSent(false); setMessage(''); }}>
                  返回登录
                </button>
              )}
            </>
          ) : (
            <div className="auth-sent">
              {mode === 'register'
                ? '验证邮件已发送，请先在邮箱中完成验证。验证通过后即可用邮箱和密码登录。'
                : '重置密码邮件已发送，请打开邮箱里的链接设置新密码。'}
            </div>
          )}

          {message && <div className="auth-error">{message}</div>}
        </form>
      </div>
    );
  }

  if (!dataReady) {
    return (
      <div className="auth-page">
        <div className="auth-panel">
          <div className="auth-title">{dataError ? '同步失败' : '正在同步数据'}</div>
          <div className="auth-sub">
            {dataError || '正在读取当前账号的项目配置和成本计划。'}
          </div>
          {dataError && <button className="auth-submit" onClick={handleLogout}>退出后重试</button>}
        </div>
      </div>
    );
  }

  return children({ user, syncStatus, onLogout: handleLogout });
}
