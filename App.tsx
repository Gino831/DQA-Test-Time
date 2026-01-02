
import React, { useState, useMemo, useEffect } from 'react';
import { 
  CategoryType, 
  TestItem, 
  StandardData, 
  ExecutionStrategy, 
  SelectedTests,
} from './types';
import { STANDARDS_DATA as INITIAL_DATA, DEFAULT_MANDATORY_TESTS } from './constants';

const APP_COLORS: Record<string, string> = {
  moxa: 'bg-indigo-500',
  railway: 'bg-amber-500',
  marine: 'bg-emerald-500',
  power: 'bg-sky-500',
  default: 'bg-slate-500'
};

const App: React.FC = () => {
  const [standards, setStandards] = useState<StandardData[]>(() => {
    const saved = localStorage.getItem('dqa_standards_v4');
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });

  const [activeApps, setActiveApps] = useState<string[]>(['moxa']);
  const [selectedTests, setSelectedTests] = useState<SelectedTests>({});
  const [strategy, setStrategy] = useState<ExecutionStrategy>(ExecutionStrategy.PARALLEL);
  const [envSampleCount, setEnvSampleCount] = useState<number>(0);
  const [mechSampleCount, setMechSampleCount] = useState<number>(0);
  const [editingStandard, setEditingStandard] = useState<{isNew: boolean, data: Partial<StandardData>} | null>(null);
  const [editingTest, setEditingTest] = useState<{standardId: string, isNew: boolean, data: Partial<TestItem>} | null>(null);

  useEffect(() => {
    localStorage.setItem('dqa_standards_v4', JSON.stringify(standards));
  }, [standards]);

  const loadDemo = () => {
    setActiveApps(['moxa', 'railway']);
    const demoSelection: SelectedTests = {
      moxa: { 'moxa_default_bf': true, 'moxa_default_2d': true, 'm_c1': true, 'm_v1': true },
      railway: { 'railway_default_bf': true, 'r_c1': true, 'r_v1': true }
    };
    setSelectedTests(demoSelection);
    setEnvSampleCount(2);
    setMechSampleCount(1);
    setStrategy(ExecutionStrategy.PARALLEL);
  };

  const toggleApp = (appId: string) => {
    setActiveApps(prev => prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]);
  };

  const toggleTest = (standardId: string, itemId: string) => {
    setSelectedTests(prev => {
      const standard = prev[standardId] || {};
      const newStandard = { ...standard, [itemId]: !standard[itemId] };
      return { ...prev, [standardId]: newStandard };
    });
  };

  const toggleAllInStandard = (standard: StandardData, select: boolean) => {
    setSelectedTests(prev => {
      const newStandardTests: { [key: string]: boolean } = {};
      Object.values(standard.categories).forEach(items => {
        (items as TestItem[] | undefined)?.forEach(item => { 
          newStandardTests[item.id] = select; 
        });
      });
      return { ...prev, [standard.id]: newStandardTests };
    });
  };

  const saveStandard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStandard) return;
    const { isNew, data } = editingStandard;
    if (isNew) {
      const newId = `app_${Date.now()}`;
      // 初始化新應用時帶入基礎測項
      const initialCategories: { [key in CategoryType]?: TestItem[] } = {};
      Object.entries(DEFAULT_MANDATORY_TESTS).forEach(([cat, tests]) => {
        initialCategories[cat as CategoryType] = tests.map(t => ({
          ...t,
          id: `${newId}_${t.id}`
        }));
      });

      const newApp: StandardData = {
        id: newId,
        name: data.name || '新應用領域',
        description: data.description || '標準描述',
        icon: data.icon || 'bolt',
        categories: initialCategories
      };
      setStandards([...standards, newApp]);
    } else {
      setStandards(standards.map(s => s.id === data.id ? { ...s, ...data } : s));
    }
    setEditingStandard(null);
  };

  const deleteStandard = (id: string) => {
    if (confirm('確定要刪除此應用領域嗎？')) {
      setStandards(standards.filter(s => s.id !== id));
      setActiveApps(activeApps.filter(appId => appId !== id));
    }
  };

  const saveTestItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest) return;
    const { standardId, isNew, data } = editingTest;
    setStandards(prev => prev.map(s => {
      if (s.id !== standardId) return s;
      const cat = (data.category as CategoryType) || CategoryType.CHAMBER;
      const currentItems = s.categories[cat] || [];
      let newCategories = { ...s.categories };
      if (isNew) {
        const newItem: TestItem = { id: `test_${Date.now()}`, name: data.name || '新測項', duration: data.duration || 1, category: cat };
        newCategories[cat] = [...currentItems, newItem];
      } else {
        newCategories[cat] = currentItems.map(i => i.id === data.id ? { ...i, ...data } : i);
      }
      return { ...s, categories: newCategories };
    }));
    setEditingTest(null);
  };

  const deleteTestItem = (standardId: string, category: CategoryType, itemId: string) => {
    if (confirm('確定刪除此測項？')) {
      setStandards(prev => prev.map(s => {
        if (s.id !== standardId) return s;
        return {
          ...s,
          categories: { ...s.categories, [category]: (s.categories[category] || []).filter(i => i.id !== itemId) }
        };
      }));
    }
  };

  const calculationResults = useMemo(() => {
    const envTracks = [CategoryType.CHAMBER, CategoryType.DUST_TEST, CategoryType.WATER_TEST, CategoryType.FUNCTION, CategoryType.OTHER];
    const mechTracks = [CategoryType.VIB_SHOCK];
    const envBreakdown: { appId: string, name: string, days: number, color: string }[] = [];
    const mechBreakdown: { appId: string, name: string, days: number, color: string }[] = [];

    standards.forEach(standard => {
      if (!activeApps.includes(standard.id)) return;
      const selectedMap = selectedTests[standard.id] || {};
      let appEnvDays = 0;
      let appMechDays = 0;

      Object.entries(standard.categories).forEach(([cat, items]) => {
        const catType = cat as CategoryType;
        const itemsList = items as TestItem[] | undefined;
        itemsList?.forEach(item => {
          if (selectedMap[item.id]) {
            if (envTracks.includes(catType)) appEnvDays += item.duration;
            if (mechTracks.includes(catType)) appMechDays += item.duration;
          }
        });
      });

      if (appEnvDays > 0) envBreakdown.push({ appId: standard.id, name: standard.name, days: appEnvDays, color: APP_COLORS[standard.id] || APP_COLORS.default });
      if (appMechDays > 0) mechBreakdown.push({ appId: standard.id, name: standard.name, days: appMechDays, color: APP_COLORS[standard.id] || APP_COLORS.default });
    });

    const envWD = envBreakdown.reduce((sum, b) => sum + b.days, 0);
    const mechWD = mechBreakdown.reduce((sum, b) => sum + b.days, 0);
    const totalWD = strategy === ExecutionStrategy.SERIAL || (envSampleCount + mechSampleCount === 1) ? (envWD + mechWD) : Math.max(envWD, mechWD);

    return { 
      totalDays: totalWD, 
      envDays: envWD, 
      mechDays: mechWD, 
      envBreakdown,
      mechBreakdown,
      totalSelectedUnits: envSampleCount + mechSampleCount,
      isSingleSampleMode: (envSampleCount + mechSampleCount === 1),
      currentExecutionMode: (strategy === ExecutionStrategy.SERIAL || (envSampleCount + mechSampleCount === 1)) ? ExecutionStrategy.SERIAL : ExecutionStrategy.PARALLEL,
      hasTests: (envWD + mechWD > 0) 
    };
  }, [standards, selectedTests, strategy, activeApps, envSampleCount, mechSampleCount]);

  return (
    <div className="min-h-screen bg-[#FDFDFC] flex flex-col xl:flex-row text-[#333D47] font-sans">
      
      {/* 左側應用導航軌道 - 寬螢幕專屬 */}
      <aside className="xl:w-80 w-full bg-white border-r border-slate-100 p-8 flex flex-col shrink-0">
        <div className="mb-12">
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter mb-1">DQA 專家系統</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Verification Strategy</p>
        </div>

        <nav className="flex-1 space-y-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Application Matrix</h4>
          {standards.map(app => (
            <div key={app.id} className="relative group">
              <button onClick={() => toggleApp(app.id)} className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 ${activeApps.includes(app.id) ? 'border-slate-900 bg-slate-50 shadow-md ring-2 ring-slate-900/5' : 'border-slate-50 bg-white hover:border-slate-200'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${activeApps.includes(app.id) ? (APP_COLORS[app.id] || APP_COLORS.default) + ' text-white' : 'bg-slate-50 text-slate-300'}`}>
                  {getAppIcon(app.icon, "w-5 h-5")}
                </div>
                <div className="text-left overflow-hidden">
                  <span className={`text-sm font-black block truncate ${activeApps.includes(app.id) ? 'text-slate-900' : 'text-slate-400'}`}>{app.name}</span>
                  <span className="text-[9px] font-bold text-slate-300 uppercase truncate">Active Application</span>
                </div>
              </button>
              <div className="absolute top-1/2 -right-4 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-full pr-4 z-10">
                <button onClick={() => setEditingStandard({isNew: false, data: app})} className="p-2 bg-white shadow-xl rounded-xl text-slate-400 hover:text-indigo-600 border border-slate-50"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2}/></svg></button>
                <button onClick={() => deleteStandard(app.id)} className="p-2 bg-white shadow-xl rounded-xl text-slate-400 hover:text-rose-600 border border-slate-50"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg></button>
              </div>
            </div>
          ))}
          <button onClick={() => setEditingStandard({isNew: true, data: {icon: 'bolt'}})} className="w-full flex items-center justify-center p-5 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all font-black text-[10px] uppercase tracking-widest gap-2">
            <span>+</span> 新增應用標準
          </button>
        </nav>

        <div className="mt-auto pt-8 border-t border-slate-100">
          <button onClick={loadDemo} className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-100 transition-all flex items-center justify-center gap-2">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" strokeWidth={2}/></svg>
            戴入範例資料
          </button>
        </div>
      </aside>

      {/* 主工作區 */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* 上方甘特圖 Dashboard - 固定高度且置頂 */}
        <section className={`bg-white border-b border-slate-100 px-12 py-8 shrink-0 transition-all ${!calculationResults.hasTests ? 'h-32' : 'h-auto max-h-[45vh] overflow-y-auto'}`}>
          {!calculationResults.hasTests ? (
            <div className="h-full flex items-center justify-center text-slate-300 italic font-medium">
              請從左側選擇應用領域並選取測試項目以生成時程圖
            </div>
          ) : (
            <div className="max-w-[1600px] mx-auto">
              <div className="flex justify-between items-end mb-10">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Project Timeline Analyzer</h4>
                  <h3 className="text-2xl font-black text-slate-900">關鍵路徑與樣本分配分析</h3>
                </div>
                <div className="flex items-center gap-12 text-right">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Working Days</span>
                    <span className="text-5xl font-black text-indigo-600 tracking-tighter tabular-nums">{calculationResults.totalDays}</span>
                  </div>
                  <div className="h-12 w-px bg-slate-100"></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sets Required</span>
                    <span className="text-5xl font-black text-slate-900 tracking-tighter tabular-nums">{calculationResults.totalSelectedUnits}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-12">
                {/* Track A */}
                {calculationResults.envDays > 0 && (
                  <div className="space-y-4">
                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Track A: Environmental ({calculationResults.envDays} WD)</span>
                    </div>
                    <div className="h-14 w-full bg-slate-50 rounded-2xl flex overflow-hidden border border-slate-100 shadow-inner">
                      {calculationResults.envBreakdown.map(seg => (
                        <div key={seg.appId} className={`${seg.color} h-full border-r border-white/20 last:border-r-0 flex flex-col items-center justify-center relative group/seg`} style={{ width: `${(seg.days / calculationResults.totalDays) * 100}%` }}>
                          <span className="text-[9px] font-black text-white/90 truncate px-2">{seg.name} ({seg.days}D)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Track B */}
                {calculationResults.mechDays > 0 && (
                  <div className="space-y-4">
                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Track B: Mechanical ({calculationResults.mechDays} WD)</span>
                    </div>
                    <div className="h-14 w-full bg-slate-50 rounded-2xl relative overflow-hidden border border-slate-100 flex shadow-inner">
                      <div className="absolute top-0 bottom-0 flex transition-all duration-500" style={{ 
                        left: calculationResults.currentExecutionMode === ExecutionStrategy.SERIAL ? `${(calculationResults.envDays / calculationResults.totalDays) * 100}%` : '0', 
                        width: `${(calculationResults.mechDays / calculationResults.totalDays) * 100}%` 
                      }}>
                        {calculationResults.mechBreakdown.map(seg => (
                          <div key={seg.appId} className={`${seg.color} h-full border-r border-white/20 last:border-r-0 flex flex-col items-center justify-center group/seg`} style={{ width: `${(seg.days / calculationResults.mechDays) * 100}%` }}>
                            <span className="text-[9px] font-black text-white/90 truncate px-2">{seg.name} ({seg.days}D)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 下方內容區 - 可捲動 */}
        <div className="flex-1 overflow-y-auto bg-[#FDFDFC] px-12 py-10">
          <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* 測項清單區 (8 columns) */}
            <div className="lg:col-span-8 space-y-12">
              {standards.filter(s => activeApps.includes(s.id)).map(standard => (
                <div key={standard.id} className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-50 transition-all hover:shadow-xl hover:shadow-slate-200/50">
                  <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-6 border-b border-slate-100 gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${APP_COLORS[standard.id] || APP_COLORS.default} text-white rounded-2xl flex items-center justify-center shadow-lg`}>
                        {getAppIcon(standard.icon, "w-6 h-6")}
                      </div>
                      <h2 className="text-xl font-black text-slate-900">{standard.name}</h2>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingTest({standardId: standard.id, isNew: true, data: {category: CategoryType.CHAMBER, duration: 1}})} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-slate-200 hover:bg-black transition-all">+ 新增測項</button>
                      <button onClick={() => toggleAllInStandard(standard, true)} className="px-5 py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-100 transition-colors">全選</button>
                      <button onClick={() => toggleAllInStandard(standard, false)} className="px-5 py-2.5 bg-slate-50 text-rose-500 rounded-xl text-[10px] font-black uppercase hover:bg-rose-50 transition-colors">取消</button>
                    </div>
                  </header>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                    {Object.values(CategoryType).map(cat => {
                      const items = standard.categories[cat] || [];
                      if (items.length === 0) return null;
                      return (
                        <div key={cat} className="space-y-4">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-l-4 border-slate-100 pl-3">{cat}</h4>
                          <div className="space-y-2">
                            {items.map(item => {
                              const isSelected = selectedTests[standard.id]?.[item.id];
                              return (
                                <div key={item.id} className="relative group/item">
                                  <button onClick={() => toggleTest(standard.id, item.id)} className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 ${isSelected ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-50 bg-white hover:border-slate-200'}`}>
                                    <div className="text-left overflow-hidden">
                                      <span className={`text-xs font-black block truncate ${isSelected ? 'text-slate-900' : 'text-slate-300'}`}>{item.name}</span>
                                      <span className={`text-[9px] font-bold uppercase tracking-widest ${isSelected ? 'text-slate-400' : 'text-slate-200'}`}>{item.duration} WD</span>
                                    </div>
                                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-100 text-transparent'}`}>
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    </div>
                                  </button>
                                  <div className="absolute top-1/2 -right-12 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover/item:opacity-100 transition-all pointer-events-auto z-10">
                                    <button onClick={(e) => { e.stopPropagation(); setEditingTest({standardId: standard.id, isNew: false, data: item}); }} className="p-1.5 bg-white shadow-xl rounded-lg text-slate-400 hover:text-indigo-600 border border-slate-50"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5}/></svg></button>
                                    <button onClick={(e) => { e.stopPropagation(); deleteTestItem(standard.id, cat, item.id); }} className="p-1.5 bg-white shadow-xl rounded-lg text-slate-400 hover:text-rose-600 border border-slate-50"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 控制面板區 (4 columns) */}
            <div className="lg:col-span-4 space-y-10">
              <div className="sticky top-0 space-y-10">
                <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden border border-slate-800">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 rounded-full -mr-16 -mt-16 blur-[60px]"></div>
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-8">Infrastructure Settings</h3>
                  
                  <div className="space-y-10">
                    <div className="flex justify-between items-center group">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Track A Samples</span>
                        <span className="text-[9px] font-bold text-slate-600">Environmental Units</span>
                      </div>
                      <div className="flex items-center bg-white/5 rounded-2xl p-1 border border-white/5">
                        <button onClick={() => setEnvSampleCount(Math.max(0, envSampleCount - 1))} className="w-10 h-10 text-xl font-light hover:bg-white/10 rounded-xl transition-all">-</button>
                        <span className="w-12 text-center font-black text-xl tabular-nums">{envSampleCount}</span>
                        <button onClick={() => setEnvSampleCount(envSampleCount + 1)} className="w-10 h-10 text-xl font-light hover:bg-white/10 rounded-xl transition-all">+</button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center group">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Track B Samples</span>
                        <span className="text-[9px] font-bold text-slate-600">Mechanical Units</span>
                      </div>
                      <div className="flex items-center bg-white/5 rounded-2xl p-1 border border-white/5">
                        <button onClick={() => setMechSampleCount(Math.max(0, mechSampleCount - 1))} className="w-10 h-10 text-xl font-light hover:bg-white/10 rounded-xl transition-all">-</button>
                        <span className="w-12 text-center font-black text-xl tabular-nums">{mechSampleCount}</span>
                        <button onClick={() => setMechSampleCount(mechSampleCount + 1)} className="w-10 h-10 text-xl font-light hover:bg-white/10 rounded-xl transition-all">+</button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 pt-8 border-t border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-indigo-100 tracking-[0.2em]">Strategy Mode</span>
                      <span className="text-[10px] font-bold text-slate-500 italic">Auto-Optimization</span>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setStrategy(ExecutionStrategy.SERIAL)} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${calculationResults.currentExecutionMode === ExecutionStrategy.SERIAL ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>接續串聯</button>
                      <button disabled={calculationResults.totalSelectedUnits <= 1} onClick={() => setStrategy(ExecutionStrategy.PARALLEL)} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${calculationResults.currentExecutionMode === ExecutionStrategy.PARALLEL ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white/5 text-slate-400 hover:bg-white/10'} disabled:opacity-20`}>並聯加速</button>
                    </div>
                  </div>
                </div>

                {/* 底部功能區 */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items Configured</span>
                      <span className="text-3xl font-black text-slate-900 tabular-nums">
                        {(Object.values(selectedTests) as Record<string, boolean>[]).reduce((sum, std) => sum + Object.values(std).filter(v => v).length, 0)}
                        <small className="text-xs font-bold text-slate-400 ml-2 uppercase">Tests</small>
                      </span>
                    </div>
                    <button onClick={() => { if(confirm('清除所有規劃設定？')) { setSelectedTests({}); setEnvSampleCount(0); setMechSampleCount(0); } }} className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-all active:scale-95 group">
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg>
                    </button>
                  </div>
                  <button className="w-full py-6 bg-slate-900 text-white rounded-[1.8rem] font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:bg-black hover:-translate-y-1 transition-all active:scale-95">更新分析結果</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* 測項編輯彈窗 */}
      {editingTest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <form onSubmit={saveTestItem} className="bg-white rounded-[3.5rem] p-16 max-w-lg w-full shadow-2xl border border-white/20">
            <h3 className="text-3xl font-black mb-12 text-slate-900 tracking-tight">調整測項參數</h3>
            <div className="space-y-10">
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">測項名稱</label>
                <input required type="text" value={editingTest.data.name || ''} onChange={e => setEditingTest({...editingTest, data: {...editingTest.data, name: e.target.value}})} className="w-full bg-slate-50 rounded-[1.8rem] px-8 py-6 outline-none font-black border border-slate-100 focus:bg-white transition-all text-xl shadow-inner"/>
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">工期 (Working Days)</label>
                <div className="relative">
                  <input required type="number" step="0.1" value={editingTest.data.duration || ''} onChange={e => setEditingTest({...editingTest, data: {...editingTest.data, duration: parseFloat(e.target.value)}})} className="w-full bg-slate-50 rounded-[1.8rem] px-8 py-6 outline-none font-black border border-slate-100 focus:bg-white transition-all text-2xl pr-20 shadow-inner tabular-nums"/>
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 font-black text-sm uppercase">WD</span>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">規劃分類</label>
                <select value={editingTest.data.category} onChange={e => setEditingTest({...editingTest, data: {...editingTest.data, category: e.target.value as CategoryType}})} className="w-full bg-slate-50 rounded-[1.8rem] px-8 py-6 outline-none font-black border border-slate-100 focus:bg-white transition-all appearance-none cursor-pointer text-lg shadow-inner">
                  {Object.values(CategoryType).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-5 mt-16">
              <button type="button" onClick={() => setEditingTest(null)} className="flex-1 py-7 bg-slate-50 text-slate-400 rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-colors">取消</button>
              <button type="submit" className="flex-1 py-7 bg-slate-900 text-white rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest shadow-2xl hover:bg-black transition-all">確認儲存</button>
            </div>
          </form>
        </div>
      )}

      {/* 領域編輯彈窗 */}
      {editingStandard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <form onSubmit={saveStandard} className="bg-white rounded-[3.5rem] p-16 max-w-md w-full shadow-2xl border border-white/20">
            <h3 className="text-3xl font-black mb-12 text-slate-900 tracking-tight">定義測試標準</h3>
            <div className="space-y-10">
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">名稱</label>
                <input required type="text" value={editingStandard.data.name || ''} onChange={e => setEditingStandard({...editingStandard, data: {...editingStandard.data, name: e.target.value}})} className="w-full bg-slate-50 rounded-[1.8rem] px-8 py-6 outline-none font-black border border-slate-100 focus:bg-white transition-all text-xl shadow-inner"/>
              </div>
              <div className="space-y-5">
                <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1 text-center block">專屬圖示</label>
                <div className="flex gap-5 p-5 bg-slate-50 rounded-[2.2rem] border border-slate-100 shadow-inner">
                  {['factory', 'train', 'ship', 'bolt'].map(icon => (
                    <button key={icon} type="button" onClick={() => setEditingStandard({...editingStandard, data: {...editingStandard.data, icon}})} className={`flex-1 aspect-square rounded-2xl flex items-center justify-center transition-all duration-300 ${editingStandard.data.icon === icon ? 'bg-indigo-600 text-white shadow-2xl scale-110' : 'text-slate-300 hover:text-slate-500 hover:bg-white'}`}>
                      {getAppIcon(icon, "w-7 h-7")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-5 mt-16">
              <button type="button" onClick={() => setEditingStandard(null)} className="flex-1 py-7 bg-slate-50 text-slate-400 rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-colors">取消</button>
              <button type="submit" className="flex-1 py-7 bg-slate-900 text-white rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest shadow-2xl hover:bg-black transition-all">儲存標準</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

const getAppIcon = (iconName: string, className: string = "w-6 h-6") => {
  switch (iconName) {
    case 'factory': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" strokeWidth={1.5}/></svg>;
    case 'train': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 4h14a2 2 0 012 2v6H3V6a2 2 0 012-2zm0 14h14a2 2 0 012 2v2H3v-2a2 2 0 012-2zM3 12h18v4H3v-4z" strokeWidth={1.5}/></svg>;
    case 'ship': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 19l9 2-9-18-9 18 9-2" strokeWidth={1.5}/></svg>;
    case 'bolt': return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth={1.5}/></svg>;
    default: return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth={2}/></svg>;
  }
};

const getCategoryTrackColor = (category: CategoryType) => {
  switch (category) {
    case CategoryType.CHAMBER: return 'bg-[#D6A060]';
    case CategoryType.VIB_SHOCK: return 'bg-[#6D7B8D]';
    case CategoryType.DUST_TEST: return 'bg-[#768F7E]';
    case CategoryType.WATER_TEST: return 'bg-[#3A86FF]';
    case CategoryType.FUNCTION: return 'bg-[#C26B6B]';
    default: return 'bg-slate-400';
  }
};

export default App;
