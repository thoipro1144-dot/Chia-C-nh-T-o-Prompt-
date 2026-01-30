
import React, { useState, useRef, useEffect } from 'react';
import { AppStatus, ScriptAnalysisResult, ProjectSaveData, CharacterProfile, Scene } from './types';
import { splitScriptIntoSegments, enrichSingleSegment, generateCharacterProfile, generateProjectMetadata } from './services/geminiService';
import { Button } from './components/Button';
import { SceneCard } from './components/SceneCard';

const VISUAL_STYLES = [
  { id: 'cinematic', name: 'Master Narrative', desc: 'Direct Address, Professional Lighting' },
  { id: 'noir', name: 'Dramatic Noir', desc: 'High contrast, moody atmosphere' },
  { id: 'soft', name: 'Soft Intimate', desc: 'Warm haze, gentle focus' }
];

const BATCH_SIZE = 5;

const App: React.FC = () => {
  const [projectName, setProjectName] = useState('Dự án Truyện của tôi');
  const [script, setScript] = useState('');
  const [charLimit, setCharLimit] = useState(120); 
  const [rawSegments, setRawSegments] = useState<string[]>([]);
  const [charEditRequest, setCharEditRequest] = useState('');
  
  const [character, setCharacter] = useState<CharacterProfile | null>(null);
  const [charName, setCharName] = useState('');
  const [charInfo, setCharInfo] = useState('');
  const [charPhysical, setCharPhysical] = useState('');
  const [fixedBG, setFixedBG] = useState('');
  const [narratorSubject, setNarratorSubject] = useState('');

  const [selectedStyle, setSelectedStyle] = useState('cinematic');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [isGeneratingChar, setIsGeneratingChar] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [autoProcess, setAutoProcess] = useState(false); // Tính năng Auto mới
  const [result, setResult] = useState<ScriptAnalysisResult | null>(null);
  const [streamingScenes, setStreamingScenes] = useState<Scene[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const importInputRef = useRef<HTMLInputElement>(null);

  const getActiveCharacter = (): CharacterProfile => {
    return {
      name: charName || 'Người kể chuyện',
      characterInfo: charInfo || '',
      physicalAppearance: charPhysical || '',
      fixedBackground: fixedBG || '',
      voiceIdentity: character?.voiceIdentity || '',
      bodyLanguage: character?.bodyLanguage || '',
      cinematographyStyle: character?.cinematographyStyle || '',
      narratorSubject: narratorSubject || ''
    };
  };

  const handleUpdateScene = (updatedScene: Scene) => {
    setStreamingScenes(prev => prev.map(s => s.id === updatedScene.id ? updatedScene : s));
    setResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        scenes: prev.scenes.map(s => s.id === updatedScene.id ? updatedScene : s)
      };
    });
  };

  const handleSplitSegments = async () => {
    if (!script.trim()) return alert("Vui lòng nhập kịch bản.");
    setStatus(AppStatus.DIVIDING);
    try {
      const segments = await splitScriptIntoSegments(script, charLimit);
      setRawSegments(segments);
      
      const shellScenes: Scene[] = segments.map((seg, idx) => ({
        id: idx + 1,
        originalSegment: seg,
        isBRoll: false,
        promptImage: '',
        visualPrompt: '',
        visualNarratorPrompt: '',
        motionDescription: '',
        emotionDescription: '',
        sceneMusicSuggestion: '',
        dialogue: '',
        shotType: 'Đang chờ...',
        cameraAngle: '',
        lighting: '',
        backgroundDescription: ''
      }));

      setStreamingScenes(shellScenes);
      setCurrentIndex(0);
      
      const activeChar = getActiveCharacter();
      const initialResult: ScriptAnalysisResult = {
        projectName,
        mainCharacter: activeChar,
        scenes: shellScenes,
        overallTone: 'Đang phân tích...',
        visualStyle: selectedStyle,
        hasBackgroundMusic: true,
        suggestedMusicDescription: 'Đang phân tích...'
      };
      setResult(initialResult);
      setStatus(AppStatus.COMPLETED); 
    } catch (err: any) {
      alert("Lỗi: " + err.message);
      setStatus(AppStatus.ERROR);
    }
  };

  const processBatch = async (startIndex: number) => {
    const activeChar = getActiveCharacter();
    if (!activeChar.narratorSubject) return alert("Vui lòng tạo 'Profile AI' cho nhân vật trước khi tạo Storyboard.");
    
    setIsBatchProcessing(true);
    try {
      if (startIndex === 0) {
        const metadata = await generateProjectMetadata(script);
        setResult(prev => prev ? { ...prev, ...metadata, mainCharacter: activeChar } : null);
      }

      const endIndex = Math.min(startIndex + BATCH_SIZE, rawSegments.length);
      const updatedScenes = [...streamingScenes];

      for (let i = startIndex; i < endIndex; i++) {
        const fullScene = await enrichSingleSegment(rawSegments[i], i + 1, activeChar, selectedStyle);
        updatedScenes[i] = fullScene; 
        setStreamingScenes([...updatedScenes]);
        setResult(prev => prev ? { ...prev, scenes: [...updatedScenes] } : null);
        setCurrentIndex(i + 1);
      }

      // Logic AUTO: Nếu được bật và vẫn còn cảnh, tự chạy tiếp đợt sau
      if (autoProcess && endIndex < rawSegments.length) {
        setTimeout(() => processBatch(endIndex), 500);
      }
    } catch (err: any) {
      alert("Lỗi xử lý: " + err.message);
      setAutoProcess(false); // Dừng auto nếu lỗi
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleGenerateChar = async () => {
    if (!script.trim()) return alert("Vui lòng nhập kịch bản trước.");
    setIsGeneratingChar(true);
    try {
      const char = await generateCharacterProfile(script, charEditRequest, character);
      setCharacter(char);
      setCharName(char.name);
      setCharInfo(char.characterInfo);
      setCharPhysical(char.physicalAppearance);
      setFixedBG(char.fixedBackground);
      setNarratorSubject(char.narratorSubject);
    } catch (err: any) {
      alert("Lỗi tạo profile: " + err.message);
    } finally {
      setIsGeneratingChar(false);
    }
  };

  const handleExport = () => {
    const activeChar = getActiveCharacter();
    const data: ProjectSaveData = { 
      projectName, script, customCharDesc: charEditRequest, selectedStyle, hasBackgroundMusic: true, 
      result: result ? { ...result, mainCharacter: activeChar } : null 
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPromptsTxt = () => {
    if (!result || !result.scenes) return;
    const content = result.scenes
      .filter(s => s.promptImage && s.promptImage !== '')
      .map((s, idx) => `${idx + 1}. ${s.promptImage.replace(/<HIGHLIGHT>/g, '').replace(/<\/HIGHLIGHT>/g, '')}`)
      .join('\n');
    
    if (!content) return alert("Chưa có prompt nào được khởi tạo.");
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}_prompts.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadVisualNarratorPromptsTxt = () => {
    if (!result || !result.scenes) return;
    const content = result.scenes
      .filter(s => s.visualNarratorPrompt && s.visualNarratorPrompt !== '')
      .map((s, idx) => `${idx + 1}. ${s.visualNarratorPrompt.replace(/<HIGHLIGHT>/g, '').replace(/<\/HIGHLIGHT>/g, '')}`)
      .join('\n');
    
    if (!content) return alert("Chưa có visual narrator prompt nào được khởi tạo.");
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}_visual_narrator_prompts.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as ProjectSaveData;
        
        setProjectName(data.projectName || 'Dự án Import');
        setScript(data.script || '');
        setCharEditRequest(data.customCharDesc || '');
        setSelectedStyle(data.selectedStyle || 'cinematic');
        
        if (data.result) {
          const char = data.result.mainCharacter;
          setResult(data.result);
          setStreamingScenes(data.result.scenes || []);
          setCharacter(char); 
          setCharName(char.name || ''); 
          setCharInfo(char.characterInfo || ''); 
          setCharPhysical(char.physicalAppearance || ''); 
          setFixedBG(char.fixedBackground || ''); 
          setNarratorSubject(char.narratorSubject || '');
          setRawSegments((data.result.scenes || []).map(s => s.originalSegment));
          const processedCount = (data.result.scenes || []).filter(s => s.promptImage && s.promptImage !== '').length;
          setCurrentIndex(processedCount);
          setStatus(AppStatus.COMPLETED);
        } else {
          setStatus(AppStatus.IDLE);
        }
        e.target.value = '';
      } catch (err) { 
        alert("Lỗi: File JSON không hợp lệ hoặc bị hỏng."); 
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const goToEditor = () => {
    setStatus(AppStatus.IDLE);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goToResults = () => {
    setStatus(AppStatus.COMPLETED);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const progressPercentage = rawSegments.length > 0 ? Math.round((currentIndex / rawSegments.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 selection:bg-blue-500/30 font-sans">
      {/* Branding Banner */}
      <div className="w-full bg-black py-4 px-8 flex items-center gap-6 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-xl flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#10b981"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="text-white text-4xl font-black italic tracking-tighter leading-none">BODHIMEDIA</div>
            <div className="text-[#10b981] text-[12px] font-black tracking-[0.3em] mt-1 leading-none">HAPPY EVERYDAY</div>
          </div>
        </div>
        <div className="flex flex-col ml-2 pl-6 border-l border-white/10">
          <div className="text-2xl font-bold text-white">Nơi Tinh Hoa Hội Tụ</div>
          <div className="text-2xl font-medium text-white">Nơi Trí Tuệ Việt Được Vươn Tầm Thế Giới</div>
        </div>
      </div>

      <header className="sticky top-0 z-50 bg-black/95 border-b border-white/5 px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={goToEditor}>
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white group-hover:rotate-12 transition-transform shadow-lg shadow-blue-600/20">S</div>
          <h1 className="font-black uppercase tracking-widest text-lg group-hover:text-blue-400 transition-colors">ScriptStudio <span className="text-blue-500">Narrative</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImport} />
          <Button variant="ghost" className="text-[10px] uppercase font-black tracking-widest" onClick={() => importInputRef.current?.click()}>Import Dự án</Button>
          {result && (
            <div className="flex gap-2">
              <Button variant="ghost" className="text-[10px] uppercase font-black tracking-widest border border-white/10 px-6 hover:bg-emerald-500/10 hover:text-emerald-400" onClick={handleDownloadPromptsTxt}>
                Tải Prompts (.txt)
              </Button>
              <Button variant="ghost" className="text-[10px] uppercase font-black tracking-widest border border-white/10 px-6 hover:bg-blue-500/10 hover:text-blue-400" onClick={handleDownloadVisualNarratorPromptsTxt}>
                Tải Visual Prompts (.txt)
              </Button>
              <Button variant="ghost" className="text-[10px] uppercase font-black tracking-widest border border-white/10 px-6" onClick={handleExport}>
                Export Dự án (.json)
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto p-8 space-y-12">
        {rawSegments.length > 0 && (
          <div className="flex items-center justify-center gap-8 py-4 bg-white/[0.02] rounded-full border border-white/5 backdrop-blur-md sticky top-24 z-40 shadow-xl">
            <button 
              onClick={goToEditor}
              className={`flex items-center gap-2 px-8 py-3 rounded-full transition-all text-[11px] font-black uppercase tracking-widest ${status !== AppStatus.COMPLETED ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-white'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              Trở về kịch bản
            </button>
            <div className="h-4 w-px bg-white/10"></div>
            <button 
              onClick={goToResults}
              className={`flex items-center gap-2 px-8 py-3 rounded-full transition-all text-[11px] font-black uppercase tracking-widest ${status === AppStatus.COMPLETED ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-white'}`}
            >
              Quay lại dự án
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </div>
        )}

        {status !== AppStatus.COMPLETED ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-white/[0.03] p-10 rounded-[45px] border border-white/10 shadow-2xl backdrop-blur-3xl">
                <input 
                  value={projectName} onChange={e => setProjectName(e.target.value)}
                  className="bg-transparent border-none text-5xl font-black text-blue-500 outline-none uppercase tracking-tighter w-full mb-10"
                  placeholder="TÊN DỰ ÁN"
                />
                <textarea 
                  value={script} onChange={e => setScript(e.target.value)}
                  placeholder="Dán kịch bản chi tiết của bạn vào đây..."
                  className="w-full h-[450px] bg-black/60 rounded-[30px] p-12 text-xl font-serif italic border border-white/5 resize-none shadow-inner leading-relaxed focus:border-blue-500/30 transition-colors"
                />
                <div className="mt-8 bg-black/40 border border-white/5 p-10 rounded-[35px] space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Giới hạn ký tự (Max 120): {charLimit}</span>
                    <input type="range" min="60" max="120" step="5" value={charLimit} onChange={e => setCharLimit(parseInt(e.target.value))} className="w-48 h-1.5 bg-slate-800 rounded-lg appearance-none accent-blue-600" />
                  </div>
                  <Button onClick={handleSplitSegments} isLoading={status === AppStatus.DIVIDING} className="w-full rounded-2xl h-20 uppercase font-black tracking-[0.3em] text-sm">
                    PHÂN CẢNH KỊCH BẢN
                  </Button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
              <div className="bg-white/[0.03] p-10 rounded-[45px] border border-white/10 space-y-6 backdrop-blur-3xl sticky top-48">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Thiết kế Nhân vật</h3>
                <input value={charName} onChange={e => setCharName(e.target.value)} placeholder="Tên nhân vật..." className="w-full bg-black/60 rounded-xl p-4 text-[12px] border border-white/5 focus:border-blue-500/50 outline-none" />
                <textarea value={charEditRequest} onChange={e => setCharEditRequest(e.target.value)} placeholder="Mô tả đặc điểm cho AI..." className="w-full h-24 bg-black/60 rounded-xl p-4 text-[12px] border border-white/5 resize-none focus:border-blue-500/50 outline-none" />
                <Button onClick={handleGenerateChar} isLoading={isGeneratingChar} className="w-full rounded-xl py-3 text-[10px] uppercase font-black tracking-widest">Tạo Profile AI</Button>
                <div className="pt-4 border-t border-white/10">
                  <label className="text-[9px] font-black uppercase text-emerald-400 mb-2 block tracking-widest">Subject AI (Cấu trúc Prompt)</label>
                  <textarea value={narratorSubject} onChange={e => setNarratorSubject(e.target.value)} className="w-full h-32 bg-emerald-500/5 rounded-xl p-4 text-[12px] border border-emerald-500/20 font-mono text-emerald-200 focus:border-emerald-500/50 outline-none" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-16 animate-in fade-in duration-700">
            <div className="bg-white/[0.03] border border-white/10 p-12 rounded-[55px] shadow-2xl backdrop-blur-3xl relative overflow-hidden">
               <div className="flex flex-col xl:flex-row justify-between items-center gap-12 relative z-10">
                  <div className="space-y-6 text-center xl:text-left">
                     <h2 className="text-7xl font-black uppercase italic tracking-tighter text-white leading-none">{projectName}</h2>
                     <div className="flex items-center gap-4 justify-center xl:justify-start">
                        <div className="px-5 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-black text-blue-400 uppercase tracking-widest">
                           {currentIndex} / {rawSegments.length} Cảnh hoàn tất
                        </div>
                        {(isBatchProcessing || autoProcess) && currentIndex < rawSegments.length && (
                           <div className="flex gap-2 items-center px-4">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                              <span className="text-[9px] font-black uppercase text-blue-500 tracking-widest">
                                {autoProcess ? "CHẾ ĐỘ AUTO ĐANG CHẠY..." : "AI ĐANG XỬ LÝ..."}
                              </span>
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="relative w-48 h-48 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/[0.05]" />
                        <circle 
                          cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" 
                          strokeDasharray={552}
                          strokeDashoffset={552 - (552 * progressPercentage) / 100}
                          strokeLinecap="round"
                          className={`text-blue-500 transition-all duration-1000 ${(isBatchProcessing || autoProcess) ? 'drop-shadow-[0_0_15px_rgba(59,130,246,1)]' : ''}`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-6xl font-black tracking-tighter text-white ${(isBatchProcessing || autoProcess) ? 'animate-pulse' : ''}`}>
                          {progressPercentage}<span className="text-2xl text-blue-500">%</span>
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mt-2">XỬ LÝ</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-6">
                     <div className="flex items-center gap-3 px-6 py-3 bg-white/5 rounded-full border border-white/10">
                        <input 
                           type="checkbox" 
                           id="autoProcess" 
                           checked={autoProcess} 
                           onChange={(e) => setAutoProcess(e.target.checked)}
                           className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-600 bg-black/40 cursor-pointer"
                        />
                        <label htmlFor="autoProcess" className="text-[11px] font-black uppercase tracking-widest text-slate-300 cursor-pointer">
                           Tự động chạy tiếp (Auto)
                        </label>
                     </div>

                     {currentIndex < rawSegments.length && (
                        <Button 
                           onClick={() => processBatch(currentIndex)} 
                           isLoading={isBatchProcessing}
                           className="h-28 px-16 rounded-[35px] text-[15px] uppercase font-black tracking-[0.2em] bg-blue-600 shadow-[0_0_50px_rgba(59,130,246,0.2)] border border-blue-500/30"
                        >
                           {currentIndex === 0 ? "Bắt đầu tạo Storyboard" : "Tiếp tục tạo phân cảnh"}
                        </Button>
                     )}
                  </div>
               </div>
            </div>
            
            <div className="space-y-12 pb-24">
              {streamingScenes.map((scene) => (
                <SceneCard 
                  key={scene.id} 
                  scene={scene} 
                  voiceIdentity={character?.voiceIdentity || ''} 
                  characterProfile={getActiveCharacter()}
                  onUpdateScene={handleUpdateScene}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
