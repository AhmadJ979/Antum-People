import React, { useState, useEffect } from 'react';

// Unified API Base URL helper
const API_BASE = window.location.port === '5173' ? 'http://localhost:3000' : '';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  role: string;
  manager_id: string;
  start_date: string;
  end_date: string | null;
  status: 'onboarding' | 'active' | 'offboarding' | 'terminated';
  salary: number;
  recruitment_cost: number;
  fully_productive_date: string | null;
  national_id_type: string | null;
  national_id_value: string | null;
  data_residency_country: string | null;
  consent_granted: number;
  consent_date: string | null;
  visa_status: string | null;
  visa_expiry_date: string | null;
  basic_salary: number;
  eosb_accrued: number;
  eosb_paid: number;
}

interface Task {
  id: string;
  employee_id: string;
  title: string;
  description: string;
  due_date: string;
  completed_at: string | null;
  status: 'pending' | 'completed' | 'overdue';
  category: string;
  ttv_milestone?: number;
}

interface Analytics {
  activeHeadcount: number;
  monthlyPayroll: number;
  eosbLiability: number;
  attritionRate: number;
  avgCostPerHireAE: number;
  avgCostPerHireSA: number;
  avgTtvDays: number;
  ttvByDepartment: { department: string; avgDays: number; target: number }[];
  retentionLiftSeries: { cohort: string; retention: number; benchmark: number; lift: number }[];
  eosbLiabilitySeries: { quarter: string; uae: number; ksa: number; combined: number }[];
  eosbByJurisdiction: { AE: number; SA: number };
  exitsByReason: { reason: string; count: number }[];
  activeSalarySpend: number;
  totalRecruitingSpend: number;
}

function Login({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data.token, data.user);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 font-sans">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-2xl">
        <div className="flex justify-center mb-8">
          <div className="bg-teal-600 p-3 rounded-xl shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-extrabold text-center text-slate-900 mb-2">Antum People</h2>
        <p className="text-slate-500 text-center mb-8 text-sm">HR Onboarding/Offboarding Intelligence Platform</p>
        
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-lg font-medium flex items-center">
             <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
               <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
             </svg>
             {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition text-slate-900"
              placeholder="Enter your username"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition text-slate-900"
              placeholder="••••••••"
              required
            />
            <div className="flex justify-end mt-2">
              <button 
                type="button"
                onClick={() => alert('Please contact IT support for password recovery.')}
                className="text-xs text-teal-600 hover:text-teal-700 font-medium hover:underline"
              >
                Forgot Password?
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 focus:ring-4 focus:ring-slate-200 transition shadow-lg disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Enterprise HR Intelligence</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('antum_token'));
  const [user, setUser] = useState<any | null>(JSON.parse(localStorage.getItem('antum_user') || 'null'));
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'transitions' | 'analytics'>('dashboard');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [onboardingTasks, setOnboardingTasks] = useState<Task[]>([]);
  const [offboardingTasks, setOffboardingTasks] = useState<Task[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  // Compliance Documents
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [renderedTemplate, setRenderedTemplate] = useState<{ title: string, content: string } | null>(null);

  // Modals and Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    first_name: '',
    last_name: '',
    email: '',
    department: 'Engineering',
    role: '',
    manager_id: '',
    start_date: new Date().toISOString().split('T')[0],
    salary: '',
    recruitment_cost: '',
    national_id_type: 'Emirates ID',
    national_id_value: '',
    data_residency_country: 'AE',
    visa_status: 'Employment Visa',
    visa_expiry_date: '',
    basic_salary: ''
  });

  const [exitForm, setExitForm] = useState({
    departure_reason: 'Compensation',
    detailed_feedback: '',
    satisfaction_score: '3',
    preventable: '0',
    new_employer: '',
    new_salary: ''
  });

  const handleLogin = (newToken: string, userData: any) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('antum_token', newToken);
    localStorage.setItem('antum_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('antum_token');
    localStorage.removeItem('antum_user');
  };

  const authedFetch = (url: string, options: any = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [empRes, anaRes] = await Promise.all([
        authedFetch(`${API_BASE}/api/employees`),
        authedFetch(`${API_BASE}/api/analytics/dashboard`)
      ]);
      
      if (empRes.status === 401 || anaRes.status === 401) {
        handleLogout();
        return;
      }

      const empData = await empRes.json();
      const anaData = await anaRes.json();
      
      // Defensive checks to prevent .filter crashes
      const safeEmpData = Array.isArray(empData) ? empData : [];
      setEmployees(safeEmpData);
      setAnalytics(anaData && !anaData.error ? anaData : null);
      
      // Keep selected employee state fresh
      if (selectedEmployee) {
        const updated = safeEmpData.find((e: Employee) => e.id === selectedEmployee.id);
        if (updated) {
          setSelectedEmployee(updated);
          fetchTasks(updated.id);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async (employeeId: string) => {
    if (!token) return;
    try {
      const [onRes, offRes] = await Promise.all([
        authedFetch(`${API_BASE}/api/employees/${employeeId}/onboarding`),
        authedFetch(`${API_BASE}/api/employees/${employeeId}/offboarding`)
      ]);
      
      if (onRes.status === 401 || offRes.status === 401) {
        handleLogout();
        return;
      }

      const onData = await onRes.json();
      const offData = await offRes.json();
      
      setOnboardingTasks(Array.isArray(onData) ? onData : []);
      setOffboardingTasks(Array.isArray(offData) ? offData : []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  const fetchTemplate = async (templateName: string, title: string) => {
    if (!selectedEmployee || !token) return;
    try {
      const res = await authedFetch(`${API_BASE}/api/compliance/templates/${templateName}/${selectedEmployee.id}`);
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setRenderedTemplate({ title, content: data.content });
        setShowTemplateModal(true);
      }
    } catch (err) {
      console.error('Error fetching template:', err);
    }
  };

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    fetchTasks(emp.id);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await authedFetch(`${API_BASE}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee)
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        setShowAddModal(false);
        setNewEmployee({
          first_name: '',
          last_name: '',
          email: '',
          department: 'Engineering',
          role: '',
          manager_id: '',
          start_date: new Date().toISOString().split('T')[0],
          salary: '',
          recruitment_cost: '',
          national_id_type: 'Emirates ID',
          national_id_value: '',
          data_residency_country: 'AE',
          visa_status: 'Employment Visa',
          visa_expiry_date: '',
          basic_salary: ''
        });
        await fetchData();
      }
    } catch (err) {
      console.error('Error creating employee:', err);
    }
  };

  const handleUpdateTask = async (taskId: string, type: 'onboarding' | 'offboarding', status: 'pending' | 'completed') => {
    if (!token) return;
    try {
      const endpoint = type === 'onboarding' ? 'onboarding-tasks' : 'offboarding-tasks';
      const res = await authedFetch(`${API_BASE}/api/${endpoint}/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok && selectedEmployee) {
        await fetchTasks(selectedEmployee.id);
        await fetchData();
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const handleMarkProductive = async () => {
    if (!selectedEmployee || !token) return;
    const productiveDate = new Date().toISOString().split('T')[0];
    try {
      const res = await authedFetch(`${API_BASE}/api/employees/${selectedEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fully_productive_date: productiveDate, status: 'active' })
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error updating productivity date:', err);
    }
  };

  const handleTransitionToOffboarding = async () => {
    if (!selectedEmployee || !token) return;
    try {
      const res = await authedFetch(`${API_BASE}/api/employees/${selectedEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'offboarding', end_date: new Date().toISOString().split('T')[0] })
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error initiating offboarding:', err);
    }
  };

  const handleExitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !token) return;
    try {
      const res = await authedFetch(`${API_BASE}/api/exit-interviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: selectedEmployee.id,
          interview_date: new Date().toISOString().split('T')[0],
          ...exitForm,
          satisfaction_score: parseInt(exitForm.satisfaction_score),
          preventable: parseInt(exitForm.preventable),
          new_salary: parseFloat(exitForm.new_salary) || 0
        })
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        setShowExitModal(false);
        setExitForm({
          departure_reason: 'Compensation',
          detailed_feedback: '',
          satisfaction_score: '3',
          preventable: '0',
          new_employer: '',
          new_salary: ''
        });
        await fetchData();
      }
    } catch (err) {
      console.error('Error submitting exit interview:', err);
    }
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between shadow-lg">
        <div>
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xl font-bold tracking-wider">Antum</span>
            </div>
            <button onClick={handleLogout} className="text-slate-500 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-800" title="Sign Out">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
          <div className="px-6 py-4 border-b border-slate-800/50">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-500">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-white truncate">{user?.username || 'Admin User'}</div>
                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{user?.role || 'Administrator'}</div>
              </div>
            </div>
          </div>
          <nav className="p-4 space-y-2">
            {[
              { id: 'dashboard', label: 'Executive Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
              { id: 'employees', label: 'Employee Directory', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
              { id: 'transitions', label: 'Transitions Hub', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
              { id: 'analytics', label: 'Strategic Intelligence', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as any); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition text-left ${activeTab === item.id ? 'bg-teal-600 text-white font-medium shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-slate-500 text-xs text-center font-mono">
          Antum People v1.0
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-500">
            <span className="font-semibold text-slate-800 capitalize">{activeTab} Panel</span>
            <span>/</span>
            <span className="text-xs font-mono text-teal-500">GCC Intelligence Tier</span>
            <span className="ml-4 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded uppercase border border-amber-200">Sample Demo Data</span>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => fetchData()} 
              className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
              </svg>
              <span>{loading ? 'Syncing...' : 'Refresh Hub'}</span>
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-teal-600 text-white hover:bg-teal-700 text-xs font-bold px-4 py-2 rounded-lg shadow transition flex items-center space-x-1"
            >
              <span className="text-sm">+</span>
              <span>Hire Employee</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Retention Lift */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between text-slate-400 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Retention Lift (1-yr)</span>
                    <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900">
                    {(analytics?.retentionLiftSeries?.length ?? 0) > 0 ? (
                      <>
                        {(analytics?.retentionLiftSeries?.[analytics.retentionLiftSeries!.length - 1]?.lift ?? 0) > 0 ? '+' : ''}
                        {(analytics?.retentionLiftSeries?.[analytics.retentionLiftSeries!.length - 1]?.lift ?? 0)}%
                      </>
                    ) : (
                      <span className="text-sm font-medium text-slate-400 italic">No data yet</span>
                    )}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-600 mt-2 flex items-center">
                    <span className="mr-1">ℹ️</span> Illustrative
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Illustrative Benchmark</p>
                </div>

                {/* Time-to-Value */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between text-slate-400 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Time-to-Value</span>
                    <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900">
                    {analytics?.avgTtvDays ? `${analytics.avgTtvDays} d` : <span className="text-sm font-medium text-slate-400 italic">No data yet</span>}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-600 mt-2 flex items-center">
                    <span className="mr-1">ℹ️</span> Illustrative
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">target: 15 days</p>
                </div>

                {/* Cost-per-Hire */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between text-slate-400 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cost-per-Hire</span>
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 leading-tight">
                    {analytics ? (
                      <div className="space-y-1">
                        {analytics.avgCostPerHireAE > 0 && (
                          <div className="flex items-baseline space-x-2">
                            <span className="text-xs text-slate-400 uppercase">AE</span>
                            <span>{analytics.avgCostPerHireAE.toLocaleString()} <span className="text-sm font-bold text-slate-400">AED</span></span>
                          </div>
                        )}
                        {analytics.avgCostPerHireSA > 0 && (
                          <div className="flex items-baseline space-x-2">
                            <span className="text-xs text-slate-400 uppercase">SA</span>
                            <span>{analytics.avgCostPerHireSA.toLocaleString()} <span className="text-sm font-bold text-slate-400">SAR</span></span>
                          </div>
                        )}
                        {!analytics.avgCostPerHireAE && !analytics.avgCostPerHireSA && (
                          <span className="text-sm font-medium text-slate-400 italic">No data yet</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-slate-400 italic">No data yet</span>
                    )}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-600 mt-2 flex items-center">
                    <span className="mr-1">ℹ️</span> Illustrative Benchmark
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">recruitment + onboarding</p>
                </div>

                {/* EOSB Liability */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between text-slate-400 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">EOSB Liability</span>
                    <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 leading-tight">
                    {analytics ? (
                      <div className="space-y-1">
                        {analytics.eosbByJurisdiction.AE > 0 && (
                          <div className="flex items-baseline space-x-2">
                            <span className="text-xs text-slate-400 uppercase">AE</span>
                            <span>{analytics.eosbByJurisdiction.AE.toLocaleString()} <span className="text-sm font-bold text-slate-400">AED</span></span>
                          </div>
                        )}
                        {analytics.eosbByJurisdiction.SA > 0 && (
                          <div className="flex items-baseline space-x-2">
                            <span className="text-xs text-slate-400 uppercase">SA</span>
                            <span>{analytics.eosbByJurisdiction.SA.toLocaleString()} <span className="text-sm font-bold text-slate-400">SAR</span></span>
                          </div>
                        )}
                        {!analytics.eosbByJurisdiction.AE && !analytics.eosbByJurisdiction.SA && (
                          <span className="text-sm font-medium text-slate-400 italic">No data yet</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-slate-400 italic">No data yet</span>
                    )}
                  </div>
                  <div className="text-[10px] font-semibold text-rose-600 mt-2 flex items-center">
                    <span className="mr-1">ℹ️</span> Illustrative Total
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Accrued to date across regions
                  </p>
                </div>
              </div>

              {/* Transition Funnels */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4 flex justify-between items-center">
                    <span>Onboarding Pipeline</span>
                    <button onClick={() => setActiveTab('transitions')} className="text-xs text-teal-600 hover:underline">View All &rarr;</button>
                  </h3>
                  <div className="space-y-3">
                    {employees.filter(e => e.status === 'onboarding').slice(0, 3).map(emp => (
                      <div key={emp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-xs">
                            {emp.first_name[0]}{emp.last_name[0]}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">{emp.first_name} {emp.last_name}</div>
                            <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{emp.role}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 bg-white border border-slate-200 rounded text-slate-600">
                          Started {emp.start_date}
                        </span>
                      </div>
                    ))}
                    {employees.filter(e => e.status === 'onboarding').length === 0 && (
                      <div className="py-8 text-center text-slate-400 text-sm italic">No active onboardings.</div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4 flex justify-between items-center">
                    <span>Offboarding Pipeline</span>
                    <button onClick={() => setActiveTab('transitions')} className="text-xs text-amber-600 hover:underline">View All &rarr;</button>
                  </h3>
                  <div className="space-y-3">
                    {employees.filter(e => e.status === 'offboarding').slice(0, 3).map(emp => (
                      <div key={emp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">
                            {emp.first_name[0]}{emp.last_name[0]}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">{emp.first_name} {emp.last_name}</div>
                            <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{emp.role}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 bg-white border border-slate-200 rounded text-amber-600">
                          Exit {emp.end_date || 'Pending'}
                        </span>
                      </div>
                    ))}
                    {employees.filter(e => e.status === 'offboarding').length === 0 && (
                      <div className="py-8 text-center text-slate-400 text-sm italic">No active offboardings.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'employees' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <th className="p-4">Name & Region</th>
                      <th className="p-4">Department / Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Gratuity Accrued</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr 
                        key={emp.id} 
                        onClick={() => handleSelectEmployee(emp)}
                        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition ${selectedEmployee?.id === emp.id ? 'bg-teal-50/50' : ''}`}
                      >
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{emp.first_name} {emp.last_name}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">{emp.data_residency_country === 'SA' ? '🇸🇦 SAUDI ARABIA' : '🇦🇪 UAE'}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-semibold">{emp.role}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-tight">{emp.department}</div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-tighter ${
                            emp.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                            emp.status === 'onboarding' ? 'bg-blue-100 text-blue-800' :
                            emp.status === 'offboarding' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {emp.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-bold text-teal-600 font-mono">
                            {emp.data_residency_country === 'SA' ? 'SAR' : 'AED'} {(emp.eosb_accrued || 0).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400">Accrued to date</div>
                        </td>
                        <td className="p-4 text-right">
                          <button className="text-teal-600 font-bold text-xs hover:underline">Manage &rarr;</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedEmployee && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-300">
                  {/* Transition Checklists */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md border border-slate-200 space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                      <h4 className="font-bold text-slate-900">
                        {selectedEmployee.status === 'onboarding' ? 'Onboarding Checklist' : 
                         selectedEmployee.status === 'offboarding' ? 'Offboarding Checklist' : 'Transition Tasks'}
                      </h4>
                      <div className="flex space-x-2">
                        {selectedEmployee.status === 'onboarding' && (
                          <button onClick={handleMarkProductive} className="bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-700 shadow-sm transition">Mark Productive</button>
                        )}
                        {(selectedEmployee.status === 'active' || selectedEmployee.status === 'onboarding') && (
                          <button onClick={handleTransitionToOffboarding} className="bg-amber-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-amber-700 shadow-sm transition">Initiate Exit</button>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {(selectedEmployee.status === 'onboarding' || selectedEmployee.status === 'active' ? onboardingTasks : offboardingTasks).map(task => (
                        <div key={task.id} className="flex items-start space-x-3 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-teal-200 transition">
                          <input 
                            type="checkbox" 
                            checked={task.status === 'completed'} 
                            onChange={(e) => handleUpdateTask(task.id, selectedEmployee.status === 'offboarding' ? 'offboarding' : 'onboarding', e.target.checked ? 'completed' : 'pending')}
                            className="mt-1 h-4 w-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer"
                          />
                          <div>
                            <div className={`text-sm font-bold ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</div>
                            <p className="text-xs text-slate-500 leading-relaxed">{task.description}</p>
                          </div>
                        </div>
                      ))}
                      {(selectedEmployee.status === 'onboarding' || selectedEmployee.status === 'active' ? onboardingTasks : offboardingTasks).length === 0 && (
                        <div className="py-12 text-center text-slate-400 text-sm italic">No tasks generated for this stage.</div>
                      )}
                    </div>
                  </div>

                  {/* Document & Compliance Center */}
                  <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg space-y-6">
                    <h4 className="font-bold text-teal-400 text-sm tracking-widest uppercase">Compliance Center</h4>
                    
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Privacy Consent (PDPL)</div>
                        <div className={`text-xs font-bold ${selectedEmployee.consent_granted ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {selectedEmployee.consent_granted ? `✓ GRANTED ON ${selectedEmployee.consent_date}` : '✗ MISSING / REQUIRED'}
                        </div>
                      </div>

                      <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">EOSB Calculation Basis</div>
                        <div className="text-xs font-bold text-teal-300">
                          {selectedEmployee.data_residency_country === 'SA' ? 'Total Salary (KSA Rule)' : 'Basic Salary (UAE Rule)'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Document Previews</div>
                      <button 
                        onClick={() => fetchTemplate('privacy-notice', 'PDPL Privacy Notice')}
                        className="w-full text-left p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700/50 flex items-center space-x-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-xs">P</div>
                        <span className="text-xs font-bold">Privacy Notice</span>
                      </button>
                      <button 
                        onClick={() => fetchTemplate(selectedEmployee.data_residency_country === 'SA' ? 'ksa-employment-contract' : 'uae-employment-contract', 'Employment Contract')}
                        className="w-full text-left p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700/50 flex items-center space-x-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">C</div>
                        <span className="text-xs font-bold">Labor Contract</span>
                      </button>
                      {(selectedEmployee.status === 'offboarding' || selectedEmployee.status === 'terminated') && (
                        <button 
                          onClick={() => fetchTemplate('final-settlement-statement', 'Final Settlement')}
                          className="w-full text-left p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700/50 flex items-center space-x-3"
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">S</div>
                          <span className="text-xs font-bold">Settlement Statement</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'transitions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Similar to before but more focused on transition lists */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4 uppercase text-xs tracking-widest">Ramping Employees (Onboarding)</h3>
                <div className="space-y-4">
                  {employees.filter(e => e.status === 'onboarding').map(emp => (
                    <div key={emp.id} onClick={() => { setSelectedEmployee(emp); setActiveTab('employees'); }} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-teal-50/50 cursor-pointer transition flex justify-between items-center">
                      <div className="font-bold text-sm text-slate-800">{emp.first_name} {emp.last_name}</div>
                      <div className="text-[10px] font-bold text-teal-600">Day {Math.ceil((Date.now() - new Date(emp.start_date).getTime()) / (1000*60*60*24))}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4 uppercase text-xs tracking-widest">Departing Employees (Offboarding)</h3>
                <div className="space-y-4">
                  {employees.filter(e => e.status === 'offboarding').map(emp => (
                    <div key={emp.id} onClick={() => { setSelectedEmployee(emp); setActiveTab('employees'); }} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-amber-50/50 cursor-pointer transition flex justify-between items-center">
                      <div className="font-bold text-sm text-slate-800">{emp.first_name} {emp.last_name}</div>
                      <div className="text-[10px] font-bold text-amber-600">EXIT {emp.end_date}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-8 animate-in fade-in duration-500 pb-12">
              {/* Executive Summary Banner */}
              <div className="bg-teal-900 text-white p-8 rounded-2xl shadow-xl">
                <h3 className="text-xl font-bold mb-6">Strategic Workforce Intelligence</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="p-4 bg-white/10 rounded-xl border border-white/5">
                      <div className="text-teal-300 text-[10px] font-bold uppercase mb-2">Retention Insight (Illustrative)</div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        Retention lift has {(analytics?.retentionLiftSeries?.length ?? 0) > 0 && (analytics?.retentionLiftSeries?.[analytics.retentionLiftSeries!.length - 1]?.lift ?? 0) > 0 ? 'increased' : 'stabilized'} in recent cohorts.
                      </p>
                   </div>
                   <div className="p-4 bg-white/10 rounded-xl border border-white/5">
                      <div className="text-emerald-300 text-[10px] font-bold uppercase mb-2">Productivity Gap (Illustrative)</div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        Average Time-to-Value is {analytics?.avgTtvDays || 0} days.
                      </p>
                   </div>
                   <div className="p-4 bg-white/10 rounded-xl border border-white/5">
                      <div className="text-rose-300 text-[10px] font-bold uppercase mb-2">Liability Exposure (Illustrative)</div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        EOSB liability forecast shows a {(analytics?.eosbLiabilitySeries?.[2]?.combined ?? 0) > (analytics?.eosbLiabilitySeries?.[0]?.combined ?? 0) ? 'rise' : 'steady'} trend into 2027.
                      </p>
                   </div>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Retention Lift Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Retention Lift — 1-Yr Cohort</h4>
                      <p className="text-[10px] text-slate-400">Comparing cohort retention (Illustrative Benchmark)</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    {analytics?.retentionLiftSeries?.map(s => (
                      <div key={s.cohort} className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-slate-600">{s.cohort}</span>
                          <span className="text-teal-600">Lift: {s.lift > 0 ? '+' : ''}{s.lift}%</span>
                        </div>
                        <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden flex">
                          <div className="h-full bg-teal-600" style={{ width: `${s.retention}%` }}></div>
                          <div className="absolute top-0 bottom-0 border-r-2 border-slate-400 border-dashed" style={{ left: `${s.benchmark}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400">
                          <span>{s.retention}% (Cohort)</span>
                          <span>{s.benchmark}% (Illustrative)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Time-to-Value Trend */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Time-to-Value by Department</h4>
                      <p className="text-[10px] text-slate-400">Avg days to full productivity (Illustrative Target)</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    {analytics?.ttvByDepartment?.map(d => (
                      <div key={d.department} className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-slate-600">{d.department}</span>
                          <span className={d.avgDays > d.target ? 'text-rose-600' : 'text-emerald-600'}>
                            {d.avgDays} d {d.avgDays > d.target ? '(Over)' : '(Under)'}
                          </span>
                        </div>
                        <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden flex">
                          <div className={`h-full ${d.avgDays > d.target ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (d.avgDays / 30) * 100)}%` }}></div>
                          <div className="absolute top-0 bottom-0 border-r-2 border-slate-800" style={{ left: `${(d.target / 30) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                    {(!analytics?.ttvByDepartment || analytics.ttvByDepartment.length === 0) && (
                      <div className="py-12 text-center text-slate-400 italic text-xs">Insufficient productivity data.</div>
                    )}
                  </div>
                </div>

                {/* EOSB Liability Forecast */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">EOSB Liability Forecast — by Jurisdiction & Quarter</h4>
                      <p className="text-[10px] text-slate-400">Illustrative forecast based on UAE basic and KSA total salary rules</p>
                    </div>
                    <div className="flex space-x-4">
                      <div className="flex items-center space-x-1.5">
                        <div className="w-2.5 h-2.5 bg-teal-600 rounded-sm"></div>
                        <span className="text-[10px] font-bold text-slate-500">UAE</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div>
                        <span className="text-[10px] font-bold text-slate-500">KSA</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between h-48 space-x-4 px-4 border-b border-slate-100">
                    {analytics?.eosbLiabilitySeries?.map(s => {
                      const max = Math.max(...analytics.eosbLiabilitySeries.map(x => x.combined)) * 1.1;
                      const uaeHeight = (s.uae / max) * 100;
                      const ksaHeight = (s.ksa / max) * 100;
                      return (
                        <div key={s.quarter} className="flex-1 flex flex-col items-center group">
                          <div className="w-full max-w-[60px] flex flex-col-reverse h-full relative">
                            <div className="bg-teal-600 w-full rounded-t-sm" style={{ height: `${uaeHeight}%` }}></div>
                            <div className="bg-emerald-500 w-full" style={{ height: `${ksaHeight}%` }}></div>
                            {/* Tooltip placeholder */}
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10 font-mono shadow-xl border border-slate-700">
                              <div className="flex justify-between space-x-2"><span>UAE:</span> <span>{s.uae.toLocaleString()} AED</span></div>
                              <div className="flex justify-between space-x-2 border-t border-slate-700 mt-1 pt-1"><span>KSA:</span> <span>{s.ksa.toLocaleString()} SAR</span></div>
                            </div>
                          </div>
                          <div className="mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{s.quarter}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: HIRE EMPLOYEE */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-slate-900 text-lg">New Strategic Hire</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-light">&times;</button>
            </div>
            <form onSubmit={handleCreateEmployee} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">First Name</label>
                  <input type="text" required value={newEmployee.first_name} onChange={e => setNewEmployee({...newEmployee, first_name: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm font-medium" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last Name</label>
                  <input type="text" required value={newEmployee.last_name} onChange={e => setNewEmployee({...newEmployee, last_name: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm font-medium" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
                <input type="email" required value={newEmployee.email} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm font-medium" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Department</label>
                  <select value={newEmployee.department} onChange={e => setNewEmployee({...newEmployee, department: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium">
                    <option>Engineering</option><option>Product</option><option>Sales</option><option>Marketing</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Role</label>
                  <input type="text" required value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm font-medium" />
                </div>
              </div>
              
              <div className="p-5 bg-teal-50/50 rounded-2xl border border-teal-100 space-y-4">
                <h5 className="text-[10px] font-black text-teal-700 uppercase tracking-widest">GCC Localized Compliance</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Jurisdiction</label>
                    <select value={newEmployee.data_residency_country} onChange={e => setNewEmployee({...newEmployee, data_residency_country: e.target.value})} className="w-full p-2.5 bg-white border border-teal-200 rounded-xl outline-none text-sm font-bold text-teal-900">
                      <option value="AE">🇦🇪 United Arab Emirates</option>
                      <option value="SA">🇸🇦 Saudi Arabia</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Basic Salary (Monthly)</label>
                    <input type="number" required value={newEmployee.basic_salary} onChange={e => setNewEmployee({...newEmployee, basic_salary: e.target.value})} className="w-full p-2.5 bg-white border border-teal-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm font-bold text-teal-900" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">National ID Value</label>
                      <input type="text" required placeholder="784-XXXX-XXXXXXX-X" value={newEmployee.national_id_value} onChange={e => setNewEmployee({...newEmployee, national_id_value: e.target.value})} className="w-full p-2.5 bg-white border border-teal-200 rounded-xl outline-none text-sm font-bold text-teal-900" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Start Date</label>
                      <input type="date" required value={newEmployee.start_date} onChange={e => setNewEmployee({...newEmployee, start_date: e.target.value})} className="w-full p-2.5 bg-white border border-teal-200 rounded-xl outline-none text-sm font-bold text-teal-900" />
                   </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition">Discard</button>
                <button type="submit" className="px-8 py-2.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 shadow-lg transition">Create Employee Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXIT INTERVIEW */}
      {showExitModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
             <div className="p-6 border-b border-slate-100 bg-rose-50 flex justify-between items-center">
                <h3 className="font-bold text-rose-900 text-lg">Exit Intelligence Intake</h3>
                <button onClick={() => setShowExitModal(false)} className="text-rose-400 hover:text-rose-600 text-2xl font-light">&times;</button>
             </div>
             <form onSubmit={handleExitSubmit} className="p-6 space-y-6">
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Primary Departure Driver</label>
                   <select value={exitForm.departure_reason} onChange={e => setExitForm({...exitForm, departure_reason: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium">
                      <option>Compensation</option><option>Career Growth</option><option>Managerial Friction</option><option>Personal/Family</option><option>Involuntary</option>
                   </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Preventable Attrition?</label>
                      <select value={exitForm.preventable} onChange={e => setExitForm({...exitForm, preventable: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium">
                        <option value="0">No (Structural/Personal)</option>
                        <option value="1">Yes (Policy/Mgmt Adjustment)</option>
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">New Salary Offered (AED/SAR)</label>
                      <input type="number" placeholder="Benchmarking data" value={exitForm.new_salary} onChange={e => setExitForm({...exitForm, new_salary: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" />
                   </div>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Qualitative Feedback Context</label>
                   <textarea rows={3} value={exitForm.detailed_feedback} onChange={e => setExitForm({...exitForm, detailed_feedback: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" />
                </div>
                <button type="submit" className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 shadow-lg transition">Finalize Offboarding & Process EOSB</button>
             </form>
          </div>
        </div>
      )}

      {/* MODAL: DOCUMENT PREVIEW */}
      {showTemplateModal && renderedTemplate && (
        <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center p-12 z-[200] backdrop-blur-xl">
           <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full h-full flex flex-col overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <div>
                    <h3 className="font-bold text-slate-900 text-xl">{renderedTemplate.title}</h3>
                    <p className="text-xs text-slate-500 font-bold tracking-widest uppercase mt-1">Legally Validated GCC Template</p>
                 </div>
                 <button onClick={() => setShowTemplateModal(false)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-xs font-bold hover:bg-slate-800 transition shadow-xl">Close Preview</button>
              </div>
              <div className="flex-1 overflow-y-auto p-16 bg-white font-serif">
                 <div className="max-w-3xl mx-auto prose prose-slate">
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 p-10 rounded-3xl border border-slate-100">
                      {renderedTemplate.content}
                    </pre>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
