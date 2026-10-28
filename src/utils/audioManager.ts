// Audio manager for handling game sound effects
class AudioManager {
  private static instance: AudioManager;
  private sounds: Map<string, HTMLAudioElement>;
  private loadedSounds: Map<string, boolean>;
  private baseVolumes: Map<string, number>;
  private master = 1;
  private muted = false;

  private constructor() {
    this.sounds = new Map();
    this.loadedSounds = new Map();
    this.baseVolumes = new Map();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public loadSound(key: string, path: string, volume: number = 0.3): void {
    if (typeof window === 'undefined') return;

    const audio = new Audio();
    audio.preload = 'auto';
    this.baseVolumes.set(key, volume);
    audio.volume = volume * this.master;

    audio.addEventListener('canplaythrough', () => {
      this.loadedSounds.set(key, true);
    });

    audio.addEventListener('error', (e) => {
      console.error(`Error loading sound ${key}:`, e);
      this.loadedSounds.set(key, false);
    });

    audio.src = path;
    this.sounds.set(key, audio);
    this.loadedSounds.set(key, false);
  }

  public playSound(key: string): void {
    const audio = this.sounds.get(key);
    const isLoaded = this.loadedSounds.get(key);

    if (this.muted) return;
    if (audio && isLoaded) {
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            audio.currentTime = 0;
          })
          .catch(error => {
            if (error.name === 'NotAllowedError') {
              console.info('Audio playback requires user interaction first');
            } else {
              console.error(`Error playing sound ${key}:`, error);
            }
          });
      }
    }
  }

  /** Master volume 0..1 (multiplies every sound's own volume) and mute, from the Settings dialog. */
  public setMasterVolume(volume: number): void {
    this.master = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 1));
    this.sounds.forEach((audio, key) => {
      audio.volume = (this.baseVolumes.get(key) ?? 0.3) * this.master;
    });
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isLoaded(key: string): boolean {
    return this.loadedSounds.get(key) || false;
  }
}

const audioManager = AudioManager.getInstance();

// Initialize game sounds
if (typeof window !== 'undefined') {
  audioManager.loadSound('purchase', '/purchase.mp3');
  audioManager.loadSound('wrong', '/wrong.mp3');
  audioManager.loadSound('click', '/click.mp3');
  audioManager.loadSound('fanfare', '/fanfare.mp3');
}

export default audioManager;
