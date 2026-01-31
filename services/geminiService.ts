
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Scene, ScriptAnalysisResult, CharacterProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateCharacterProfile = async (
  scriptText: string,
  editRequest: string = "",
  currentProfile: CharacterProfile | null = null
): Promise<CharacterProfile> => {
  const model = 'gemini-3-flash-preview';
  const prompt = `Bạn là Chuyên gia tạo hình nhân vật điện ảnh. Phân tích kịch bản và tạo profile nhân vật.
  
  NHIỆM VỤ:
  1. Phân tích nhân vật chính (người kể chuyện).
  2. Tạo "narratorSubject": Một đoạn mô tả súc tích (30-50 từ) tập trung vào ngoại hình, đôi bàn tay, trang phục, độ tuổi để làm input đồng nhất cho AI tạo ảnh.
  
  ${editRequest ? `YÊU CẦU BỔ SUNG TỪ NGƯỜI DÙNG: "${editRequest}"` : ""}
  Kịch kịch bản: ${scriptText}`;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          characterInfo: { type: Type.STRING },
          physicalAppearance: { type: Type.STRING },
          fixedBackground: { type: Type.STRING },
          voiceIdentity: { type: Type.STRING },
          bodyLanguage: { type: Type.STRING },
          cinematographyStyle: { type: Type.STRING },
          narratorSubject: { type: Type.STRING }
        },
        required: ["name", "characterInfo", "physicalAppearance", "fixedBackground", "voiceIdentity", "bodyLanguage", "cinematographyStyle", "narratorSubject"]
      }
    }
  });
  return JSON.parse(response.text || "{}") as CharacterProfile;
};

export const splitScriptIntoSegments = async (scriptText: string, charLimit: number): Promise<string[]> => {
  const model = 'gemini-3-flash-preview'; 
  const response = await ai.models.generateContent({
    model: model,
    contents: `Bạn là một biên tập viên kịch bản chuyên nghiệp với khả năng tính toán độ dài ký tự cực kỳ chính xác.
    
    NHIỆM VỤ: Chia kịch bản dưới đây thành một danh sách các phân đoạn (segments) ngắn.
    
    YÊU CẦU BẮT BUỘC:
    1. GIỚI HẠN KÝ TỰ: Mỗi phân đoạn TUYỆT ĐỐI KHÔNG ĐƯỢC VƯỢT QUÁ ${charLimit} ký tự (bao gồm cả khoảng trắng và dấu câu).
    2. ĐIỂM NGẮT: Mỗi phân đoạn PHẢI KẾT THÚC bằng một dấu câu kết thúc câu ('.', '?', '!', '...'). 
    3. LOGIC NGẮT: Nếu việc gộp câu tiếp theo vào đoạn hiện tại làm tổng số ký tự vượt quá ${charLimit}, bạn PHẢI ngắt đoạn ngay tại dấu câu cuối cùng của câu trước đó.
    4. TRÌNH TỰ: Giữ đúng 100% thứ tự các câu trong kịch bản gốc. Không được đảo lộn.
    5. NỘI DUNG: Giữ nguyên văn bản gốc, không thêm bớt, không tóm tắt, không chỉnh sửa từ ngữ.
    6. TOÀN VẸN: Đảm bảo không bỏ sót bất kỳ từ nào từ kịch bản gốc.
    
    Dữ liệu kịch bản: "${scriptText}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

export const generateProjectMetadata = async (script: string): Promise<{ overallTone: string, suggestedMusicDescription: string, visualStyle: string }> => {
  const model = 'gemini-3-flash-preview';
  const response = await ai.models.generateContent({
    model: model,
    contents: `Phân tích tông màu và âm nhạc cho kịch bản này: ${script}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallTone: { type: Type.STRING },
          suggestedMusicDescription: { type: Type.STRING },
          visualStyle: { type: Type.STRING }
        },
        required: ["overallTone", "suggestedMusicDescription", "visualStyle"]
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const enrichSingleSegment = async (
  segment: string,
  id: number,
  characterProfile: CharacterProfile,
  style: string
): Promise<Scene> => {
  const model = 'gemini-3-flash-preview';
  const prompt = `Bạn đóng vai là một Đạo diễn điện ảnh và chuyên gia kỳ cựu trong lĩnh vực tạo video AI. Nhiệm vụ của bạn là tạo ra Storyboard cho một câu chuyện kể theo ngôi thứ nhất, tập trung vào trải nghiệm hồi tưởng qua các bức ảnh cầm trên tay.

    QUY TẮC PHÂN LOẠI CẢNH (BẮT BUỘC):
    - Đặt isBRoll = true NẾU: Phân đoạn mô tả hành động, bối cảnh, hồi ức, hoặc minh họa cho lời kể.
    - Đặt isBRoll = false NẾU: Đây là lời thoại trực tiếp mà nhân vật chính nhìn vào ống kính để nói.

    YÊU CẦU CHO THUỘC TÍNH visualNarratorPrompt (TIẾNG ANH - CỰC KỲ QUAN TRỌNG):
    - Đây là prompt dùng để tạo video nhân vật nói (A-Roll consistency). PHẢI TUÂN THỦ CHÍNH XÁC cấu trúc sau. 
    - QUAN TRỌNG: Phần văn bản nằm trong thẻ <HIGHLIGHT> và </HIGHLIGHT> phải bao gồm TOÀN BỘ, CHÍNH XÁC 100% nội dung của phân đoạn "${segment}", không được thiếu bất kỳ từ nào, không được tóm tắt hay lược bỏ bất kỳ dấu câu nào.
    
    Cấu trúc mẫu:
      "Cinematic video of the character from the reference image. The character maintains their exact facial features, hairstyle, clothing, and position. The background, lighting, and camera angle must remain 100% identical to the source image without any changes. The character speaks directly to the camera: \"<HIGHLIGHT>${segment}</HIGHLIGHT>\". Only the mouth and subtle facial expressions move to match the speech. High-quality, consistent textures, no background flickering."

    YÊU CẦU PROMPT HÌNH ẢNH (promptImage) - ĐẠO DIỄN CHUYÊN NGHIỆP (TIẾNG ANH):
    - Góc nhìn (Perspective): Góc nhìn POV (Point of View) chân thực từ hướng mắt của người kể chuyện đang nhìn xuống tấm ảnh.
    - Bố cục (Layout): Bức ảnh vật lý phải chiếm chính xác 85% diện tích khung hình. Một phần bàn tay (đặc điểm: ${characterProfile.narratorSubject}) cầm tấm ảnh chỉ chiếm 15% diện tích còn lại ở các cạnh hoặc góc khung hình.
    - Đa dạng góc máy: Hãy mô tả đa dạng các cách cầm ảnh (cầm một tay, hai tay, góc nghiêng nhẹ, góc nhìn thẳng trực diện từ trên xuống) để các cảnh không bị lặp lại nhàm chán.
    - Tuyệt đối (Strict Rule): KHÔNG ĐƯỢC để lộ khuôn mặt của người kể chuyện đang cầm tấm ảnh. Chỉ thấy bàn tay và một phần tay áo nếu cần.
    - Nội dung TRONG bức ảnh (The image inside the photo):
      + Phải cực kỳ chân thực, mộc mạc, không được phi logic hay ảo diệu quá đà. 
      + Bám sát hoàn toàn vào cốt truyện và phân đoạn: "${segment}".
      + Hình dung và mô tả các nhân vật trong ảnh đang thực hiện các hành động cụ thể, biểu cảm gương mặt tự nhiên, bối cảnh đời thường sống động.
    - Chất lượng: High-quality 8k, sharp details, realistic lighting, rustic cinematic style.
    - Bối cảnh ngoài ảnh: Môi trường phòng ${characterProfile.fixedBackground} mờ nhạt, ánh sáng tự nhiên hắt vào tấm ảnh.

    Nội dung đoạn hội thoại hiện tại: "${segment}"`;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isBRoll: { type: Type.BOOLEAN },
          promptImage: { type: Type.STRING },
          visualNarratorPrompt: { type: Type.STRING },
          motionDescription: { type: Type.STRING },
          emotionDescription: { type: Type.STRING },
          sceneMusicSuggestion: { type: Type.STRING },
          dialogue: { type: Type.STRING },
          shotType: { type: Type.STRING },
          cameraAngle: { type: Type.STRING },
          lighting: { type: Type.STRING },
          backgroundDescription: { type: Type.STRING }
        },
        required: ["isBRoll", "promptImage", "visualNarratorPrompt", "motionDescription", "emotionDescription", "sceneMusicSuggestion", "dialogue", "shotType", "cameraAngle", "lighting", "backgroundDescription"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  const parsed = JSON.parse(text);
  return {
    ...parsed,
    id,
    visualPrompt: parsed.promptImage,
    originalSegment: segment 
  } as Scene;
};

export const refineScenePrompt = async (
  currentPrompt: string,
  userRequest: string,
  segment: string,
  characterProfile: CharacterProfile
): Promise<string> => {
  const model = 'gemini-3-flash-preview';
  const prompt = `Bạn là một Đạo diễn AI chuyên gia. Hãy tinh chỉnh lại prompt tạo ảnh POV bàn tay cầm ảnh dựa trên yêu cầu của người dùng.
  
  Prompt hiện tại: "${currentPrompt}"
  Nội dung phân cảnh: "${segment}"
  Yêu cầu thay đổi: "${userRequest}"
  Đặc điểm nhân vật (bàn tay): ${characterProfile.narratorSubject}

  BẮT BUỘC TUÂN THỦ:
  - Góc nhìn POV từ người kể chuyện nhìn xuống tấm ảnh.
  - Bức ảnh chiếm 85% khung hình, bàn tay chiếm 15%.
  - Tuyệt đối KHÔNG LỘ MẶT người cầm ảnh.
  - Phong cách mộc mạc, chân thực, không ảo diệu phi thực tế.
  - Chất lượng: High-quality 8k, sharp details, realistic lighting.
  - Kết quả trả về CHỈ bao gồm chuỗi prompt bằng tiếng Anh.`;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt
  });

  return response.text || currentPrompt;
};

export const generateScenePreview = async (prompt: string): Promise<string> => {
  const cleanPrompt = prompt.replace(/<HIGHLIGHT>/g, '').replace(/<\/HIGHLIGHT>/g, '');
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `Cinematic photography, masterwork, highly detailed, photorealistic, rustic atmosphere, realistic textures: ${cleanPrompt}` }] },
    config: { imageConfig: { aspectRatio: "16:9" } }
  });
  let base64Image = "";
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      base64Image = part.inlineData.data;
      break;
    }
  }
  return base64Image ? `data:image/png;base64,${base64Image}` : "";
};

export const generateSpeech = async (text: string, voiceDesc: string): Promise<Uint8Array> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { 
        voiceConfig: { 
          prebuiltVoiceConfig: { voiceName: 'Puck' } 
        } 
      },
    },
  });
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data returned");
  return decode(base64Audio);
};

export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
