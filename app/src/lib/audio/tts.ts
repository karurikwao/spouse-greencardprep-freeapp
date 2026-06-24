/**
 * Text-to-Speech Module
 * Provides voice synthesis for hands-free practice
 * Falls back to browser native TTS, with optional cloud provider integration
 */

export interface TTSOptions {
  rate?: number; // 0.1 to 10
  pitch?: number; // 0 to 2
  volume?: number; // 0 to 1
  voice?: SpeechSynthesisVoice;
}

export type TTSProvider = 'native' | 'google' | 'elevenlabs' | 'amazon';

interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  currentText: string;
  provider: TTSProvider;
}

class TextToSpeech {
  private synth: SpeechSynthesis | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private state: TTSState = {
    isPlaying: false,
    isPaused: false,
    currentText: '',
    provider: 'native',
  };
  private onStateChange: ((state: TTSState) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      
      // Voices may load asynchronously
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (this.synth) {
      this.voices = this.synth.getVoices();
    }
  }

  private updateState(updates: Partial<TTSState>) {
    this.state = { ...this.state, ...updates };
    this.onStateChange?.(this.state);
  }

  setStateChangeCallback(callback: (state: TTSState) => void) {
    this.onStateChange = callback;
  }

  /**
   * Check if TTS is available
   */
  isAvailable(): boolean {
    return this.synth !== null;
  }

  /**
   * Get available voices
   */
  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  /**
   * Get preferred English voices
   */
  getPreferredVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter(v => 
      v.lang.startsWith('en') && 
      (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))
    );
  }

  /**
   * Speak text
   */
  speak(text: string, options: TTSOptions = {}): boolean {
    if (!this.synth) {
      console.warn('TTS not available');
      return false;
    }

    // Cancel any ongoing speech
    this.stop();

    this.utterance = new SpeechSynthesisUtterance(text);
    
    // Apply options
    if (options.rate !== undefined) this.utterance.rate = options.rate;
    if (options.pitch !== undefined) this.utterance.pitch = options.pitch;
    if (options.volume !== undefined) this.utterance.volume = options.volume;
    if (options.voice) this.utterance.voice = options.voice;

    // Event handlers
    this.utterance.onstart = () => {
      this.updateState({ isPlaying: true, isPaused: false, currentText: text });
    };

    this.utterance.onend = () => {
      this.updateState({ isPlaying: false, isPaused: false, currentText: '' });
    };

    this.utterance.onerror = (event) => {
      console.error('TTS Error:', event);
      this.updateState({ isPlaying: false, isPaused: false });
    };

    this.utterance.onpause = () => {
      this.updateState({ isPaused: true });
    };

    this.utterance.onresume = () => {
      this.updateState({ isPaused: false });
    };

    this.synth.speak(this.utterance);
    return true;
  }

  /**
   * Stop speaking
   */
  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.updateState({ isPlaying: false, isPaused: false, currentText: '' });
    }
  }

  /**
   * Pause speaking
   */
  pause() {
    if (this.synth) {
      this.synth.pause();
      this.updateState({ isPaused: true });
    }
  }

  /**
   * Resume speaking
   */
  resume() {
    if (this.synth) {
      this.synth.resume();
      this.updateState({ isPaused: false });
    }
  }

  /**
   * Get current state
   */
  getState(): TTSState {
    return { ...this.state };
  }

  /**
   * Check if currently playing
   */
  isPlaying(): boolean {
    return this.state.isPlaying;
  }

  /**
   * Speak question and answer for practice
   */
  speakQA(question: string, answer?: string, options: TTSOptions = {}): boolean {
    const text = answer 
      ? `Question: ${question}. Suggested response: ${answer}`
      : `Question: ${question}`;
    
    return this.speak(text, {
      rate: 0.9, // Slightly slower for clarity
      ...options,
    });
  }

  /**
   * Preload voices (call this early to ensure voices are loaded)
   */
  preload() {
    if (this.synth) {
      // Trigger voice loading
      this.synth.getVoices();
    }
  }
}

// Singleton instance
export const tts = new TextToSpeech();

// React hook for TTS state
export function createTTSStateListener(callback: (state: TTSState) => void) {
  tts.setStateChangeCallback(callback);
  return () => tts.setStateChangeCallback(() => {});
}
