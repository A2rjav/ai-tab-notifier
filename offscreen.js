/**
 * AI Tab Notifier — Offscreen Document Script
 * 
 * Handles audio playback for notification sounds.
 * Service Workers cannot use the Audio API, so this offscreen
 * document acts as the audio bridge.
 */

const SOUNDS = {
  'gentle-chime': 'sounds/gentle-chime.mp3',
  'ping': 'sounds/ping.mp3',
  'success': 'sounds/success.mp3',
};

let currentAudio = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PLAY_SOUND' && msg.target === 'offscreen') {
    playSound(msg.sound || 'gentle-chime', msg.volume || 0.7);
  }
});

function playSound(soundName, volume) {
  // Stop any currently playing sound
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  const soundFile = SOUNDS[soundName] || SOUNDS['gentle-chime'];

  try {
    currentAudio = new Audio(soundFile);
    currentAudio.volume = Math.min(1, Math.max(0, volume));
    currentAudio.play().catch(err => {
      console.error('[AI Tab Notifier] Audio playback failed:', err);
      // Fallback: generate a tone using Web Audio API
      playGeneratedTone(volume);
    });
  } catch (e) {
    console.error('[AI Tab Notifier] Audio creation failed:', e);
    playGeneratedTone(volume);
  }
}

/**
 * Fallback: Generate a pleasant notification tone using Web Audio API
 * in case the MP3 files fail to load.
 */
function playGeneratedTone(volume) {
  try {
    const ctx = new AudioContext();
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.value = volume * 0.3;

    // Play a pleasant two-tone chime
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 (major chord)
    const duration = 0.15;

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      noteGain.gain.value = 0;
      noteGain.gain.setValueAtTime(0, ctx.currentTime + i * duration);
      noteGain.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + i * duration + 0.02);
      noteGain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * duration + duration);
      
      osc.connect(noteGain);
      noteGain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + i * duration);
      osc.stop(ctx.currentTime + i * duration + duration + 0.05);
    });

    // Close context after playback
    setTimeout(() => ctx.close(), 1000);
  } catch (e) {
    console.error('[AI Tab Notifier] Web Audio fallback failed:', e);
  }
}
