
import React, { useState, useMemo, useEffect } from 'react';
import { 
  CategoryType, 
  TestItem, 
  StandardData, 
  ExecutionStrategy, 
  SelectedTests,
} from './types';
import { STANDARDS_DATA as INITIAL_DATA } from './constants';

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
      moxa: { 'm_c1': true, 'm_c3': true, 'm_v1': true, 'm_ip5x': true },
      railway: { 'r_c1': true, 'r_c2': true, 'r_v1': true }
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
      const newApp: StandardData = {
        id: `app_${Date.now()}`,
        name: data.name || '新應用領域',
        description: data.description || '標準描述',
        icon: data.icon || 'bolt',
        categories: {}
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
      setActiveApps(activeApps.filter(a => a !== id));
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
    const envTracks = [CategoryType.CHAMBER, CategoryType.IP_TEST, CategoryType.FUNCTION, CategoryType.OTHER];
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
    const totalCD = totalWD > 0 ? Math.ceil(totalWD / 5 * 7) : 0;

    return { 
      totalDays: totalWD, 
      totalCD,
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

  const handlePrint = () => { window.print(); };

  const wdToCd = (wd: number) => Math.ceil(wd / 5 * 7);

  return (
    <div className="min-h-screen bg-[#FDFDFC] text-[#333D47] font-sans pb-40 print:pb-0">
      <section className="bg-white border-b border-slate-100 py-12 px-6 no-print">
        <div className="max-w-6xl mx-auto">
          <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
            <div className="text-left">
              <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">DQA 測試規劃專家</h1>
              <p className="text-slate-400 font-medium italic tracking-wide">Interactive Project Verification Strategy</p>
            </div>
            <button onClick={loadDemo} className="px-8 py-3 rounded-full border border-indigo-200 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" strokeWidth={2}/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2}/></svg>
              載入示範規劃 (Demo)
            </button>
          </header>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {standards.map(app => (
              <div key={app.id} className="relative group">
                <button onClick={() => toggleApp(app.id)} className={`w-full flex flex-col items-center p-8 rounded-[2rem] border-2 transition-all duration-500 ${activeApps.includes(app.id) ? 'border-indigo-600 bg-indigo-50/20 shadow-xl' : 'border-slate-50 bg-white hover:border-slate-200'}`}>
                  <div className={`w-16 h-16 rounded-[1.5rem] mb-4 flex items-center justify-center transition-all ${activeApps.includes(app.id) ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-300'}`}>
                    {getAppIcon(app.icon, "w-8 h-8")}
                  </div>
                  <h3 className="font-bold text-base mb-1 truncate w-full text-center">{app.name}</h3>
                </button>
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingStandard({isNew: false, data: app})} className="p-1.5 bg-white shadow-md rounded-lg text-slate-400 hover:text-indigo-600"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2}/></svg></button>
                  <button onClick={() => deleteStandard(app.id)} className="p-1.5 bg-white shadow-md rounded-lg text-slate-400 hover:text-rose-600"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg></button>
                </div>
              </div>
            ))}
            <button onClick={() => setEditingStandard({isNew: true, data: {icon: 'bolt'}})} className="flex flex-col items-center justify-center p-8 rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400 hover:border-indigo-300 transition-colors">
              <div className="w-12 h-12 rounded-full border-2 border-slate-100 flex items-center justify-center mb-3 text-2xl font-light">+</div>
              <span className="text-[10px] font-black uppercase">新增領域</span>
            </button>
          </div>
        </div>
      </section>

      {/* 列印標題區 */}
      <div className="hidden print:block mb-10 text-center pt-10 px-10">
        <h1 className="text-4xl font-black mb-6 uppercase tracking-widest text-slate-900 border-b-4 border-slate-900 pb-4 inline-block">DQA 測試規劃與需求報告</h1>
        <div className="grid grid-cols-3 border-2 border-slate-900 bg-slate-50 overflow-hidden rounded-2xl mt-8">
          <div className="p-8 border-r-2 border-slate-900">
            <span className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">總工期 Duration</span>
            <span className="text-3xl font-black">{calculationResults.totalDays} WD</span>
            <span className="block text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">≈ {calculationResults.totalCD} Calendar Days</span>
          </div>
          <div className="p-8 border-r-2 border-slate-900">
            <span className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">樣本數 Samples</span>
            <span className="text-3xl font-black">{calculationResults.totalSelectedUnits} SETS</span>
          </div>
          <div className="p-8">
            <span className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">執行策略 Strategy</span>
            <span className="text-2xl font-black">{calculationResults.currentExecutionMode === ExecutionStrategy.SERIAL ? '串聯接續' : '並聯加速'}</span>
          </div>
        </div>
      </div>

      {calculationResults.hasTests && (
        <div className="max-w-7xl mx-auto px-6 py-12 print:py-0 print:mb-12">
          <div className="bg-white rounded-[3.5rem] p-16 border border-slate-100 shadow-sm print:p-0 print:border-none print:shadow-none">
            <header className="flex justify-between items-end mb-16 no-print">
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Project Schedule Visualization</h4>
                <h3 className="text-3xl font-black text-slate-900">專案測試進度示意圖</h3>
              </div>
              <div className="text-right">
                <span className="block text-xs font-black text-slate-400 uppercase mb-1 tracking-widest">Critical Path</span>
                <span className="text-4xl font-black text-indigo-600">{calculationResults.totalDays} WD</span>
                <span className="block text-xs text-slate-400 font-bold uppercase tracking-tighter">Approx. {calculationResults.totalCD} CD</span>
              </div>
            </header>

            <div className="space-y-20 print:space-y-12">
              {/* 環測軌道 */}
              {calculationResults.envDays > 0 && (
                <div className="space-y-8">
                  <div className="flex justify-between items-end text-xs font-black text-slate-800 uppercase tracking-widest">
                    <span className="flex items-center gap-3 text-sm">
                      <div className="w-3 h-3 rounded-full bg-slate-900"></div>
                      Track A: Environmental & Function
                    </span>
                    <span className="text-sm font-black">{calculationResults.envDays} WD</span>
                  </div>
                  <div className="h-16 w-full bg-slate-100 rounded-2xl flex overflow-hidden border border-slate-200">
                    {calculationResults.envBreakdown.map((segment) => (
                      <div key={segment.appId} className={`${segment.color} h-full border-r border-white/20 last:border-r-0 flex items-center justify-center relative group/seg`} style={{ width: `${(segment.days / calculationResults.totalDays) * 100}%` }}>
                        {(segment.days / calculationResults.totalDays) > 0.08 && (
                          <span className="absolute -top-10 text-xs font-bold text-slate-700 whitespace-nowrap bg-white/95 px-3 py-1.5 rounded-lg shadow-md border border-slate-100">
                            {segment.name} ({segment.days}D)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 機構軌道 */}
              {calculationResults.mechDays > 0 && (
                <div className="space-y-8">
                  <div className="flex justify-between items-end text-xs font-black text-slate-800 uppercase tracking-widest">
                    <span className="flex items-center gap-3 text-sm">
                      <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                      Track B: Mechanical & Dynamic
                    </span>
                    <span className="text-sm font-black">{calculationResults.mechDays} WD</span>
                  </div>
                  <div className="h-16 w-full bg-slate-100 rounded-2xl relative overflow-hidden border border-slate-200 flex">
                    <div className="absolute top-0 bottom-0 flex transition-all" style={{ left: calculationResults.currentExecutionMode === ExecutionStrategy.SERIAL ? `${(calculationResults.envDays / calculationResults.totalDays) * 100}%` : '0', width: `${(calculationResults.mechDays / calculationResults.totalDays) * 100}%` }}>
                      {calculationResults.mechBreakdown.map((segment) => (
                        <div key={segment.appId} className={`${segment.color} h-full border-r border-white/20 last:border-r-0 flex items-center justify-center relative group/seg`} style={{ width: `${(segment.days / calculationResults.mechDays) * 100}%` }}>
                          {(segment.days / calculationResults.totalDays) > 0.05 && (
                            <span className="absolute -bottom-10 text-xs font-bold text-slate-700 whitespace-nowrap bg-white/95 px-3 py-1.5 rounded-lg shadow-md border border-slate-100">
                              {segment.name} ({segment.days}D)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-16 border-t border-slate-100 text-xs font-black text-slate-400 uppercase tracking-[0.5em] print:pt-10">
                <span className="text-[10px]">Project Initiation</span>
                <span className="text-slate-900 font-extrabold bg-slate-50 px-10 py-4 rounded-full shadow-sm text-sm border border-slate-100">
                  Total Project Duration: {calculationResults.totalDays} WD <span className="text-slate-400 ml-2 font-medium">(Approx. {calculationResults.totalCD} CD)</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-16 print:block print:py-0">
        <div className="lg:col-span-8 space-y-16 print:space-y-8">
          {standards.filter(s => activeApps.includes(s.id)).map(standard => (
            <div key={standard.id} className="bg-white rounded-[3rem] p-12 shadow-sm border border-slate-50 print:p-0 print:border-none print:shadow-none print:break-inside-avoid">
              <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-100 print:mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${APP_COLORS[standard.id] || APP_COLORS.default} text-white rounded-xl flex items-center justify-center no-print shadow-lg`}>
                    {getAppIcon(standard.icon, "w-6 h-6")}
                  </div>
                  <h2 className="text-2xl font-black">{standard.name}</h2>
                </div>
                <div className="flex gap-2 no-print">
                  <button onClick={() => setEditingTest({standardId: standard.id, isNew: true, data: {category: CategoryType.CHAMBER, duration: 1}})} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-slate-200 hover:bg-black transition-all">+ 新增測項</button>
                  <button onClick={() => toggleAllInStandard(standard, true)} className="px-5 py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-100 transition-colors">全選</button>
                  <button onClick={() => toggleAllInStandard(standard, false)} className="px-5 py-2.5 bg-slate-50 text-rose-500 rounded-xl text-[10px] font-black uppercase hover:bg-rose-50 transition-colors">取消</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 print:grid-cols-2">
                {Object.values(CategoryType).map(cat => {
                  const items = standard.categories[cat] || [];
                  const selectedItemsCount = items.filter(item => selectedTests[standard.id]?.[item.id]).length;
                  if (items.length === 0) return null;
                  return (
                    <div key={cat} className={`space-y-5 print:break-inside-avoid ${selectedItemsCount === 0 ? 'print:hidden' : ''}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-6 rounded-full ${getCategoryTrackColor(cat)}`}></div>
                        <h4 className="text-xs font-black uppercase text-slate-600 tracking-widest">{cat}</h4>
                      </div>
                      <div className="space-y-3">
                        {items.map(item => {
                          const isSelected = selectedTests[standard.id]?.[item.id];
                          return (
                            <div key={item.id} className={`relative group/item ${!isSelected ? 'print:hidden' : ''}`}>
                              <button onClick={() => toggleTest(standard.id, item.id)} className={`w-full flex items-center justify-between p-6 rounded-2xl border-2 transition-all ${isSelected ? 'border-slate-900 bg-slate-50 shadow-md ring-1 ring-slate-900/5' : 'border-slate-100 bg-white hover:border-slate-200'} print:p-4 print:border-slate-200 print:bg-white`}>
                                <div className="text-left">
                                  <span className={`text-sm font-black block ${isSelected ? 'text-slate-900' : 'text-slate-300'}`}>{item.name}</span>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">{item.duration} WD / {wdToCd(item.duration)} CD</span>
                                </div>
                              </button>
                              <div className="absolute top-1/2 -right-14 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover/item:opacity-100 transition-all no-print">
                                <button onClick={(e) => { e.stopPropagation(); setEditingTest({standardId: standard.id, isNew: false, data: item}); }} className="p-2 bg-white shadow-lg rounded-xl text-slate-400 hover:text-indigo-600 border border-slate-50"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2}/></svg></button>
                                <button onClick={(e) => { e.stopPropagation(); deleteTestItem(standard.id, cat, item.id); }} className="p-2 bg-white shadow-lg rounded-xl text-slate-400 hover:text-rose-600 border border-slate-50"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg></button>
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

        {/* 右側摘要欄 */}
        <div className="lg:col-span-4 space-y-8 no-print print:hidden">
          <div className="sticky top-12 space-y-8">
            <div className="bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-600/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">Summary Insights</h3>
              <div className="mb-12">
                <div className="flex items-baseline gap-2">
                  <span className="text-[7rem] font-black leading-none tracking-tighter">{calculationResults.totalDays}</span>
                  <span className="text-xl font-bold text-slate-500 uppercase">WD</span>
                </div>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={2}/></svg>
                  ≈ {calculationResults.totalCD} Calendar Days
                </p>
                {calculationResults.isSingleSampleMode && calculationResults.hasTests && (
                  <p className="text-amber-400 text-[10px] font-bold uppercase mt-8 tracking-widest bg-amber-400/10 py-3 px-6 rounded-full inline-block italic border border-amber-400/20">⚠️ Single Sample: Serial Mode</p>
                )}
              </div>
              <div className="space-y-8 pt-10 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">環測樣品 (Track A)</span>
                  <div className="flex items-center bg-white/5 rounded-2xl p-1 border border-white/5">
                    <button onClick={() => setEnvSampleCount(Math.max(0, envSampleCount - 1))} className="w-12 h-12 text-2xl hover:bg-white/10 rounded-xl transition-all">-</button>
                    <span className="w-14 text-center font-black text-2xl">{envSampleCount}</span>
                    <button onClick={() => setEnvSampleCount(envSampleCount + 1)} className="w-12 h-12 text-2xl hover:bg-white/10 rounded-xl transition-all">+</button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">機構樣品 (Track B)</span>
                  <div className="flex items-center bg-white/5 rounded-2xl p-1 border border-white/5">
                    <button onClick={() => setMechSampleCount(Math.max(0, mechSampleCount - 1))} className="w-12 h-12 text-2xl hover:bg-white/10 rounded-xl transition-all">-</button>
                    <span className="w-14 text-center font-black text-2xl">{mechSampleCount}</span>
                    <button onClick={() => setMechSampleCount(mechSampleCount + 1)} className="w-12 h-12 text-2xl hover:bg-white/10 rounded-xl transition-all">+</button>
                  </div>
                </div>
                <div className="bg-indigo-600 rounded-[2.5rem] p-10 flex justify-between items-center mt-6 shadow-2xl shadow-indigo-900/40">
                  <span className="text-xs font-black uppercase text-indigo-100 tracking-[0.2em]">Total Units</span>
                  <span className="text-5xl font-black">{calculationResults.totalSelectedUnits} <small className="text-xs opacity-50 font-normal">Sets</small></span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-[2.8rem] p-3 border border-slate-100 flex gap-3 shadow-sm">
              <button onClick={() => setStrategy(ExecutionStrategy.SERIAL)} className={`flex-1 py-6 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${calculationResults.currentExecutionMode === ExecutionStrategy.SERIAL ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>接續串聯 (Serial)</button>
              <button disabled={calculationResults.totalSelectedUnits <= 1} onClick={() => setStrategy(ExecutionStrategy.PARALLEL)} className={`flex-1 py-6 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${calculationResults.currentExecutionMode === ExecutionStrategy.PARALLEL ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'} disabled:opacity-20`}>加速並聯 (Parallel)</button>
            </div>
          </div>
        </div>
      </main>

      {/* 測項編輯彈窗 */}
      {editingTest && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xl z-[100] flex items-center justify-center p-6 no-print">
          <form onSubmit={saveTestItem} className="bg-white rounded-[4rem] p-16 max-w-lg w-full shadow-2xl border border-white/20">
            <h3 className="text-3xl font-black mb-12 text-slate-900 tracking-tight">{editingTest.isNew ? '新增測試項目' : '編輯測項資訊'}</h3>
            <div className="space-y-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">測項名稱 Test Case Name</label>
                <input required type="text" placeholder="例如: High Temp Operation" value={editingTest.data.name || ''} onChange={e => setEditingTest({...editingTest, data: {...editingTest.data, name: e.target.value}})} className="w-full bg-slate-50 rounded-3xl px-8 py-6 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 outline-none font-bold transition-all border border-slate-100 text-lg"/>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">測試工期 (WD)</label>
                <div className="relative">
                  <input required type="number" step="0.1" value={editingTest.data.duration || ''} onChange={e => setEditingTest({...editingTest, data: {...editingTest.data, duration: parseFloat(e.target.value)}})} className="w-full bg-slate-50 rounded-3xl px-8 py-6 outline-none font-black border border-slate-100 focus:bg-white transition-all text-xl pr-16"/>
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-slate-300 font-black text-xs uppercase">WD</span>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <span className="text-indigo-400 font-bold text-xs">約 {wdToCd(editingTest.data.duration || 0)} CD</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">所屬分類 Category</label>
                <select value={editingTest.data.category} onChange={e => setEditingTest({...editingTest, data: {...editingTest.data, category: e.target.value as CategoryType}})} className="w-full bg-slate-50 rounded-3xl px-8 py-6 outline-none font-bold border border-slate-100 focus:bg-white transition-all appearance-none cursor-pointer">
                  {Object.values(CategoryType).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-16">
              <button type="button" onClick={() => setEditingTest(null)} className="flex-1 py-7 bg-slate-50 text-slate-400 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors">取消</button>
              <button type="submit" className="flex-1 py-7 bg-slate-900 text-white rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all">儲存測項</button>
            </div>
          </form>
        </div>
      )}

      {/* 領域編輯彈窗 */}
      {editingStandard && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xl z-[100] flex items-center justify-center p-6 no-print">
          <form onSubmit={saveStandard} className="bg-white rounded-[4rem] p-16 max-w-md w-full shadow-2xl border border-white/20">
            <h3 className="text-3xl font-black mb-12 text-slate-900 tracking-tight">{editingStandard.isNew ? '新增測試領域' : '編輯領域內容'}</h3>
            <div className="space-y-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">領域名稱 Category Name</label>
                <input required type="text" placeholder="例如: Railway Standard" value={editingStandard.data.name || ''} onChange={e => setEditingStandard({...editingStandard, data: {...editingStandard.data, name: e.target.value}})} className="w-full bg-slate-50 rounded-3xl px-8 py-6 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 outline-none font-bold transition-all border border-slate-100 text-lg"/>
              </div>
              <div className="space-y-5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 text-center block">選擇代表圖示 Icon Selection</label>
                <div className="flex gap-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                  {['factory', 'train', 'ship', 'bolt'].map(icon => (
                    <button key={icon} type="button" onClick={() => setEditingStandard({...editingStandard, data: {...editingStandard.data, icon}})} className={`flex-1 aspect-square rounded-[1.5rem] flex items-center justify-center transition-all ${editingStandard.data.icon === icon ? 'bg-indigo-600 text-white shadow-xl scale-110' : 'text-slate-300 hover:text-slate-500 hover:bg-white'}`}>
                      {getAppIcon(icon, "w-8 h-8")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-4 mt-16">
              <button type="button" onClick={() => setEditingStandard(null)} className="flex-1 py-7 bg-slate-50 text-slate-400 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors">取消</button>
              <button type="submit" className="flex-1 py-7 bg-slate-900 text-white rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all">儲存領域</button>
            </div>
          </form>
        </div>
      )}

      {/* 底部浮動導覽欄 */}
      <footer className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[94%] max-w-2xl bg-white/70 backdrop-blur-3xl border border-white p-6 rounded-[3.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.25)] z-50 flex items-center justify-between px-12 no-print">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Items in Matrix</span>
          <span className="text-4xl font-black text-slate-900 tracking-tighter">
            {(Object.values(selectedTests) as Record<string, boolean>[]).reduce((sum, std) => sum + Object.values(std).filter(v => v).length, 0)} 
            <span className="text-[11px] font-black text-slate-400 uppercase ml-2 tracking-widest">Selected</span>
          </span>
        </div>
        <div className="flex gap-4">
          <button onClick={() => { if(confirm('清除所有選取的測項與樣本設定？')) { setSelectedTests({}); setEnvSampleCount(0); setMechSampleCount(0); } }} className="w-16 h-16 rounded-[2rem] border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-all group" title="Reset Planner">
            <svg className="w-8 h-8 text-slate-300 group-hover:text-rose-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg>
          </button>
          <button className="px-16 bg-slate-900 text-white rounded-[2.2rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-black hover:scale-[1.02] active:scale-[0.98] transition-all py-6" onClick={handlePrint}>匯出規劃書 REPORT</button>
        </div>
      </footer>
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
    case CategoryType.IP_TEST: return 'bg-[#768F7E]';
    case CategoryType.FUNCTION: return 'bg-[#C26B6B]';
    default: return 'bg-slate-400';
  }
};

export default App;
