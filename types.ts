
export interface CharacterProfile {
  name: string;
  characterInfo: string;
  physicalAppearance: string;
  fixedBackground: string;
  voiceIdentity: string;
  bodyLanguage: string;
  cinematographyStyle: string;
  narratorSubject: string; // Thông tin chủ thể dùng cho Visual AI Prompt
}

export interface Scene {
  id: number;
  isBRoll: boolean;
  originalSegment: string;
  promptImage: string; 
  visualPrompt: string; 
  visualNarratorPrompt: string;
  motionDescription: string;
  emotionDescription: string;
  sceneMusicSuggestion: string;
  dialogue: string;
  shotType: string;
  cameraAngle: string;
  lighting: string;
  backgroundDescription: string;
}

export interface ScriptAnalysisResult {
  projectName: string;
  mainCharacter: CharacterProfile;
  scenes: Scene[];
  overallTone: string;
  visualStyle: string;
  hasBackgroundMusic: boolean;
  suggestedMusicDescription: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  DIVIDING = 'DIVIDING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ProjectSaveData {
  projectName: string;
  script: string;
  customCharDesc: string;
  selectedStyle: string;
  hasBackgroundMusic: boolean;
  result: ScriptAnalysisResult | null;
}
