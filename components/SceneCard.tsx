
import React, { useState } from 'react';
import { Scene, CharacterProfile } from '../types';
import { Button } from './Button';
import { generateScenePreview, generateSpeech, decodeAudioData, refineScenePrompt } from '../services/geminiService';

interface SceneCardProps {
  scene: Scene;
  voiceIdentity: string;
  characterProfile?: CharacterProfile;
  onUpdateScene?: (updatedScene: Scene) => void;
}

export const SceneCard: React.FC<SceneCardProps> = ({ scene, voiceIdentity, characterProfile, onUpdateScene }) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isRegeneratingPrompt, setIsRegeneratingPrompt] = useState(false);
  const [regenRequest, setRegenRequest] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'image' | 'narrator'>('idle');

  const displayPrompt = scene.promptImage || scene.visualPrompt || '';
  const isAwaiting = !displayPrompt || displayPrompt === '' || scene.shotType === 'Đang chờ...';

  const handlePreview = async () => {
    if (isAwaiting) return;
    setIsGeneratingImg(true);
    try {
      const img = await generateScenePreview(displayPrompt);
      setPreviewImage(img);
    } catch (err) { console.error(err); }
    finally { setIsGeneratingImg(false); }
  };

  const handleRegeneratePrompt = async () => {
    if (!regenRequest.trim() || !characterProfile) return;
    setIsRegeneratingPrompt(true);
    try {
      const newPrompt = await refineScenePrompt(displayPrompt, regenRequest, scene.originalSegment, characterProfile);
      const updated = { ...scene, promptImage: newPrompt, visualPrompt: newPrompt };
      if (onUpdateScene) onUpdateScene(updated);
      setRegenRequest('');
    } catch (err) {
      console.error("Lỗi tạo lại prompt:", err);
      alert("Không thể tạo lại prompt. Vui lòng thử lại.");
    } finally {
      setIsRegeneratingPrompt(false);
    }
  };

  const handleCopy = async (text: string, type: 'image' | 'narrator') => {
    const cleanText = text.replace(/<HIGHLIGHT>/g, '').replace(/<\/HIGHLIGHT>/g, '');
    await navigator.clipboard.writeText(cleanText);
    setCopyStatus(type);
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(<HIGHLIGHT>.*?<\/HIGHLIGHT>)/g);
    return parts.map((part, i) => {
      if (part.startsWith('<HIGHLIGHT>') && part.endsWith('</HIGHLIGHT>')) {
        const inner = part.replace('<HIGHLIGHT>', '').replace('<\/HIGHLIGHT>', '');
        return <mark key={i} className="bg-yellow-400 text-black px-1.5 py-0.5 rounded-md font-bold mx-1 shadow-sm">{inner}</mark>;
      }
      return part;
    });
  };

  const handlePlayVoice = async () => {
    if (isGeneratingAudio) return;
    setIsGeneratingAudio(true);
    try {
      const audioData = await generateSpeech(scene.originalSegment, voiceIdentity);
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(audioData, audioContext, 24000, 1);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (err) { console.error(err); }
    finally { setIsGeneratingAudio(false); }
  };

  return (
    <div className={`bg-[#0a0a0a] border-2 rounded-[50px] overflow-hidden shadow-2xl transition-all duration-1000 ${
      isAwaiting ? 'border-white/5 opacity-50' : 
      (scene.isBRoll ? 'border-amber-500/40 bg-amber-500/[0.015]' : 'border-sky-500/40 bg-sky-500/[0.015]')
    }`}>
      <div className="flex flex-col">
        {/* Header Phân cảnh */}
        <div className={`px-12 py-8 flex items-center justify-between border-b border-white/5 ${
          !isAwaiting && scene.isBRoll ? 'bg-amber-500/10' : 'bg-white/5'
        }`}>
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-4">
              <span className="text-4xl font-black text-white/20 select-none">#{scene.id.toString().padStart(2, '0')}</span>
              <span className={`text-[12px] font-black px-8 py-3 rounded-full uppercase tracking-[0.2em] shadow-xl border-2 ${
                isAwaiting ? 'bg-slate-800 text-slate-500 border-transparent' : 
                (scene.isBRoll ? 'bg-amber-500 text-black border-amber-400' : 'bg-sky-600 text-white border-sky-400')
              }`}>
                {isAwaiting ? 'ĐANG CHỜ' : (scene.isBRoll ? '★ B-ROLL (MINH HỌA)' : '● A-ROLL (TRỰC DIỆN)')}
              </span>
            </div>
            <div className="flex gap-10 text-[11px] font-black text-slate-400 uppercase tracking-widest italic border-l border-white/10 pl-10">
              <span className={isAwaiting ? '' : (scene.isBRoll ? 'text-amber-500' : 'text-sky-400')}>{scene.shotType}</span>
              <span>{scene.cameraAngle}</span>
              <span className="hidden sm:inline-block">{scene.lighting}</span>
            </div>
          </div>
          {!isAwaiting && (
            <Button onClick={handlePreview} isLoading={isGeneratingImg} variant="ghost" className="text-[10px] font-black uppercase px-10 py-4 border border-white/10 rounded-full hover:bg-white hover:text-black">
              Tạo Preview Ảnh
            </Button>
          )}
        </div>

        {/* Nội dung chi tiết - 7 Cột */}
        <div className="grid grid-cols-1 xl:grid-cols-7 divide-y xl:divide-y-0 xl:divide-x divide-white/5">
          {/* Cột 1: Lời dẫn chuyện */}
          <div className="p-8 bg-black/40 flex flex-col gap-4">
            <div className="flex justify-between items-center">
               <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600">Nội dung kể chuyện</div>
               <button onClick={handlePlayVoice} className={`p-2 rounded-full transition-all hover:scale-110 active:scale-90 ${isGeneratingAudio ? 'bg-slate-800 text-slate-600' : 'bg-sky-500/10 text-sky-500 hover:bg-sky-500 hover:text-white'}`}>
                  {isGeneratingAudio ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                  )}
               </button>
            </div>
            <p className="text-slate-100 text-md leading-relaxed font-serif italic border-l-2 border-white/10 pl-4">
              "{scene.originalSegment}"
            </p>
          </div>

          {/* Cột 2: Mô tả bối cảnh */}
          <div className="p-8 bg-white/[0.01]">
            <div className={`text-[9px] font-black uppercase tracking-[0.3em] mb-4 ${scene.isBRoll ? 'text-amber-500' : 'text-slate-600'}`}>Bối cảnh diễn ra</div>
            {isAwaiting ? <div className="h-4 w-3/4 bg-white/5 rounded-full animate-pulse"></div> : (
              <p className="text-[12px] text-slate-300 leading-relaxed italic">
                {scene.backgroundDescription}
              </p>
            )}
          </div>

          {/* Cột 3: Prompt Image */}
          <div className="p-8 space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-sky-500">Prompt Image</div>
              {!isAwaiting && (
                <button 
                  onClick={() => handleCopy(displayPrompt, 'image')}
                  className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-500 hover:text-white"
                  title="Sao chép prompt"
                >
                  {copyStatus === 'image' ? (
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                  )}
                </button>
              )}
            </div>
            {isAwaiting ? (
              <div className="h-20 bg-white/5 rounded-[20px] animate-pulse"></div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="bg-black/60 p-4 rounded-[20px] border border-white/5 group relative">
                   <p className="text-[11px] font-mono leading-relaxed text-slate-400 italic break-words">
                      {displayPrompt}
                   </p>
                </div>
                {/* Khu vực tạo lại prompt */}
                <div className="space-y-2 mt-2">
                  <textarea
                    value={regenRequest}
                    onChange={(e) => setRegenRequest(e.target.value)}
                    placeholder="Mô tả yêu cầu tạo lại prompt..."
                    className="w-full bg-black/40 rounded-xl p-3 text-[10px] border border-white/10 focus:border-sky-500/50 outline-none resize-none h-16 italic"
                  />
                  <Button 
                    onClick={handleRegeneratePrompt} 
                    isLoading={isRegeneratingPrompt}
                    variant="secondary"
                    className="w-full text-[9px] uppercase font-black tracking-widest py-2 rounded-xl"
                  >
                    Tạo lại Prompt
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Cột 4: Visual AI Prompt */}
          <div className="p-8 bg-blue-950/[0.03] space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-400">Visual AI Prompt</div>
              {!isAwaiting && (
                <button 
                  onClick={() => handleCopy(scene.visualNarratorPrompt, 'narrator')}
                  className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-500 hover:text-white"
                  title="Sao chép prompt"
                >
                  {copyStatus === 'narrator' ? (
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                  )}
                </button>
              )}
            </div>
            {isAwaiting ? (
              <div className="h-20 bg-white/5 rounded-[20px] animate-pulse"></div>
            ) : (
              <div className="bg-black/60 p-4 rounded-[20px] border border-blue-500/10 group relative">
                 <div className="text-[11px] font-mono leading-relaxed text-blue-300 italic break-words">
                    {renderHighlightedText(scene.visualNarratorPrompt)}
                 </div>
              </div>
            )}
          </div>

          {/* Cột 5: Cảm xúc chính */}
          <div className="p-8 bg-indigo-950/[0.03]">
             <div className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">Cảm xúc chính</div>
             {isAwaiting ? <div className="h-4 w-32 bg-white/5 rounded-full animate-pulse"></div> : (
               <div className="space-y-4">
                 <div>
                   <span className="text-[8px] text-indigo-500/50 font-black uppercase block mb-1 tracking-widest">Tâm trạng</span>
                   <p className="text-md text-white font-black italic tracking-tight">{scene.emotionDescription}</p>
                 </div>
                 <div className="h-px bg-white/5 w-full"></div>
                 <div>
                   <p className="text-slate-500 text-[10px] leading-relaxed italic">{scene.motionDescription}</p>
                 </div>
               </div>
             )}
          </div>

          {/* Cột 6: Âm thanh & Nhạc */}
          <div className="p-8 bg-sky-950/[0.03]">
             <div className="text-[9px] font-black text-sky-400 uppercase tracking-[0.3em] mb-4">Môi trường âm thanh</div>
             {isAwaiting ? <div className="h-4 w-32 bg-white/5 rounded-full animate-pulse"></div> : (
               <div className="space-y-4">
                 <p className="text-[12px] text-sky-200/70 font-medium leading-relaxed italic">"{scene.sceneMusicSuggestion}"</p>
               </div>
             )}
          </div>

          {/* Cột 7: Preview */}
          <div className="p-8 bg-black/60 flex items-center justify-center">
             {previewImage ? (
                <div className="relative group overflow-hidden rounded-[20px] border border-white/10 shadow-2xl w-full">
                   <img src={previewImage} className="w-full aspect-video object-cover transition-transform duration-1000 group-hover:scale-110" />
                </div>
              ) : (
                <div className="w-full aspect-video bg-white/[0.02] rounded-[20px] border-2 border-dashed border-white/5 flex flex-col items-center justify-center">
                   <span className="text-[7px] font-black text-slate-800 uppercase tracking-widest">Sẵn sàng</span>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};
