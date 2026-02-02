// ElevenLabs Text-to-Speech Integration

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// Popular ElevenLabs voice IDs
export const VOICE_IDS = {
  rachel: '21m00Tcm4TlvDq8ikWAM',      // Rachel - warm, conversational
  drew: '29vD33N1CtxCmqQRPOHJ',        // Drew - confident, professional
  clyde: '2EiwWnXFnvU5JabPnv8n',       // Clyde - war veteran, deep
  paul: '5Q0t7uMcjvnagumLfvZi',        // Paul - ground reporter
  domi: 'AZnzlk1XvdvUeBnXmlld',        // Domi - strong, confident
  dave: 'CYw3kZ02Hs0563khs1Fj',        // Dave - conversational, British
  fin: 'D38z5RcWu1voky8WS1ja',         // Fin - sailor, old
  sarah: 'EXAVITQu4vr4xnSDxMaL',       // Sarah - soft, young
  antoni: 'ErXwobaYiN019PkySvjV',      // Antoni - well-rounded
  thomas: 'GBv7mTt0atIp3Br8iCZE',      // Thomas - calm, British
  charlie: 'IKne3meq5aSn9XLyUdCD',     // Charlie - casual, Australian
  emily: 'LcfcDJNUP1GQjkzn1xUU',       // Emily - calm, young
  elli: 'MF3mGyEYCl7XYWbV9V6O',        // Elli - emotional, young
  callum: 'N2lVS1w4EtoT3dr4eOWO',      // Callum - hoarse, middle-aged
  patrick: 'ODq5zmih8GrVes37Dizd',     // Patrick - shouty, middle-aged
  harry: 'SOYHLrjzK2X1ezoPC6cr',       // Harry - anxious, young
  liam: 'TX3LPaxmHKxFdv7VOQHJ',        // Liam - articulate, young
  dorothy: 'ThT5KcBeYPX3keUQqHPh',     // Dorothy - pleasant, British
  josh: 'TxGEqnHWrfWFTfGW9XjX',        // Josh - deep, young
  arnold: 'VR6AewLTigWG4xSOukaG',      // Arnold - crisp, middle-aged
  charlotte: 'XB0fDUnXU5powFXDhCwa',   // Charlotte - seductive, middle-aged
  matilda: 'XrExE9yKIg1WjnnlVkGX',     // Matilda - warm, young
  matthew: 'Yko7PKs6WkxO6zA0Dzku',     // Matthew - audiobook narrator
  james: 'ZQe5CZNOzWyzPSCn5a3c',       // James - calm, old
  joseph: 'Zlb1dXrM653N07WRdFW3',      // Joseph - British, middle-aged
  jeremy: 'bVMeCyTHy58xNoL34h3p',      // Jeremy - Irish, excited
  michael: 'flq6f7yk4E4fJM5XTYuZ',     // Michael - old, American
  ethan: 'g5CIjZEefAph4nQFvHAz',       // Ethan - young, American
  george: 'jsCqWAovK2LkecY7zXl4',      // George - warm, British
  gigi: 'jBpfuIE2acCO8z3wKNLl',        // Gigi - childish, American
  freya: 'jnEr1N1C87HNJX3WWbS',        // Freya - expressive, American
  grace: 'oWAxZDx7w5VEj9dCyTzz',       // Grace - Southern, American
  daniel: 'onwK4e9ZLuTAKqWW03F9',      // Daniel - deep, British
  lily: 'pFZP5JQG7iQjIQuC4Bku',        // Lily - warm, British
  serena: 'pMsXgVXv3BLzUgSXRplE',      // Serena - pleasant, American
  adam: 'pNInz6obpgDQGcFmaJgB',        // Adam - deep, American
  nicole: 'piTKgcLEGmPE4e6mEKli',      // Nicole - whisper, American
  glinda: 'z9fAnlkpzviPz146aGWa',      // Glinda - witch, American
  mimi: 'zrHiDhphv9ZnVXBqCLjz',        // Mimi - childish, Swedish
  chris: 'iP95p4xoKVk53GoZ742B',       // Chris - casual, American
  brian: 'nPczCjzI2devNBz1zQrb',       // Brian - deep, American
  jessica: 'cgSgspJ2msm6clMCkdW9',     // Jessica - expressive, American
  bill: 'pqHfZKP75CvOlQylNhV4',        // Bill - documentary narrator
};

// Default voice - professional and clear
const DEFAULT_VOICE_ID = VOICE_IDS.matthew;

let apiKey: string | null = null;
let currentAudio: HTMLAudioElement | null = null;
let audioCache: Map<string, string> = new Map();

// Set API key
export function setElevenLabsApiKey(key: string): void {
  apiKey = key;
}

// Get API key from localStorage or environment
export function getApiKey(): string | null {
  if (apiKey) return apiKey;
  
  // Try localStorage
  const storedKey = localStorage.getItem('elevenlabs_api_key');
  if (storedKey) {
    apiKey = storedKey;
    return apiKey;
  }
  
  return null;
}

// Save API key to localStorage
export function saveApiKey(key: string): void {
  apiKey = key;
  localStorage.setItem('elevenlabs_api_key', key);
}

// Generate speech from text using ElevenLabs
export async function speak(
  text: string, 
  voiceId: string = DEFAULT_VOICE_ID,
  onEnd?: () => void
): Promise<void> {
  const key = getApiKey();
  
  if (!key) {
    console.warn('ElevenLabs API key not set. Skipping voice.');
    onEnd?.();
    return;
  }
  
  // Check cache first
  const cacheKey = `${voiceId}:${text}`;
  let audioUrl = audioCache.get(cacheKey);
  
  if (!audioUrl) {
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': key,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('ElevenLabs API error:', error);
        onEnd?.();
        return;
      }
      
      const audioBlob = await response.blob();
      audioUrl = URL.createObjectURL(audioBlob);
      audioCache.set(cacheKey, audioUrl);
    } catch (error) {
      console.error('Failed to generate speech:', error);
      onEnd?.();
      return;
    }
  }
  
  // Stop any currently playing audio
  stopSpeaking();
  
  // Play the audio
  currentAudio = new Audio(audioUrl);
  currentAudio.onended = () => {
    currentAudio = null;
    onEnd?.();
  };
  currentAudio.onerror = () => {
    currentAudio = null;
    onEnd?.();
  };
  
  try {
    await currentAudio.play();
  } catch (error) {
    console.error('Failed to play audio:', error);
    onEnd?.();
  }
}

// Pre-generate audio for all narrations (for smoother playback)
export async function preloadNarrations(
  texts: string[], 
  voiceId: string = DEFAULT_VOICE_ID
): Promise<void> {
  const key = getApiKey();
  if (!key) return;
  
  // Generate in parallel, but limit concurrency
  const batchSize = 3;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (text) => {
        const cacheKey = `${voiceId}:${text}`;
        if (audioCache.has(cacheKey)) return;
        
        try {
          const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': key,
            },
            body: JSON.stringify({
              text,
              model_id: 'eleven_monolingual_v1',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
              },
            }),
          });
          
          if (response.ok) {
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            audioCache.set(cacheKey, audioUrl);
          }
        } catch (error) {
          // Silently fail preloading
        }
      })
    );
  }
}

// Stop any currently playing audio
export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

// Check if audio is currently playing
export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

// Clear the audio cache
export function clearAudioCache(): void {
  audioCache.forEach((url) => {
    URL.revokeObjectURL(url);
  });
  audioCache.clear();
}
