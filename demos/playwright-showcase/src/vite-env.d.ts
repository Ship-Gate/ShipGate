/// <reference types="vite/client" />

// Extend Vite env for ElevenLabs
interface ImportMetaEnv {
  readonly VITE_ELEVENLABS_API_KEY?: string;
  readonly VITE_ELEVENLABS_VOICE_ID?: string;
}
