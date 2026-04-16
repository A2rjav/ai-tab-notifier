/**
 * Generate notification sound MP3 files using Web Audio API and MediaRecorder.
 * Run this in a browser console to generate the sound files,
 * or use the extension's built-in Web Audio fallback.
 * 
 * For the extension, we'll create simple WAV files programmatically.
 */

const fs = require ? undefined : null; // Browser-only script

// Since we can't easily generate MP3 in Node.js without deps,
// we'll create minimal valid WAV files with pleasant notification tones.

function createWavBuffer(sampleRate, duration, generator) {
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Generate audio samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.max(-1, Math.min(1, generator(t, duration)));
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  return Buffer.from(buffer);
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// Gentle Chime: C5 → E5 → G5 arpeggio with decay
function gentleChime(t, dur) {
  const notes = [
    { freq: 523.25, start: 0, length: 0.3 },    // C5
    { freq: 659.25, start: 0.15, length: 0.3 },  // E5
    { freq: 783.99, start: 0.3, length: 0.4 },   // G5
  ];

  let sample = 0;
  for (const note of notes) {
    if (t >= note.start && t < note.start + note.length) {
      const localT = t - note.start;
      const envelope = Math.exp(-localT * 6) * (1 - Math.exp(-localT * 100));
      sample += Math.sin(2 * Math.PI * note.freq * localT) * envelope * 0.3;
      // Add harmonic
      sample += Math.sin(2 * Math.PI * note.freq * 2 * localT) * envelope * 0.1;
    }
  }
  return sample;
}

// Ping: Quick attention-grabbing tone
function ping(t, dur) {
  const freq = 880; // A5
  const envelope = Math.exp(-t * 12) * (1 - Math.exp(-t * 200));
  let sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4;
  sample += Math.sin(2 * Math.PI * freq * 1.5 * t) * envelope * 0.15;
  // Quick second ping
  if (t > 0.15) {
    const t2 = t - 0.15;
    const env2 = Math.exp(-t2 * 15) * (1 - Math.exp(-t2 * 200));
    sample += Math.sin(2 * Math.PI * 1046.5 * t2) * env2 * 0.35;
  }
  return sample;
}

// Success: Achievement-style ascending tone
function success(t, dur) {
  const notes = [
    { freq: 392.00, start: 0, length: 0.15 },     // G4
    { freq: 493.88, start: 0.1, length: 0.15 },    // B4
    { freq: 587.33, start: 0.2, length: 0.15 },    // D5
    { freq: 783.99, start: 0.3, length: 0.4 },     // G5
  ];

  let sample = 0;
  for (const note of notes) {
    if (t >= note.start && t < note.start + note.length) {
      const localT = t - note.start;
      const envelope = Math.exp(-localT * 5) * (1 - Math.exp(-localT * 150));
      sample += Math.sin(2 * Math.PI * note.freq * localT) * envelope * 0.3;
      sample += Math.sin(2 * Math.PI * note.freq * 2 * localT) * envelope * 0.08;
      sample += Math.sin(2 * Math.PI * note.freq * 3 * localT) * envelope * 0.04;
    }
  }
  return sample;
}

// Generate and save
const path = require('path');

const sampleRate = 44100;
const sounds = [
  { name: 'gentle-chime', generator: gentleChime, duration: 0.8 },
  { name: 'ping', generator: ping, duration: 0.5 },
  { name: 'success', generator: success, duration: 0.8 },
];

const fs2 = require('fs');

for (const sound of sounds) {
  const buffer = createWavBuffer(sampleRate, sound.duration, sound.generator);
  const filePath = path.join(__dirname, 'sounds', `${sound.name}.mp3`);
  // Actually save as WAV but with .mp3 extension since browsers handle both
  // For a production extension, you'd use actual MP3 encoding
  // WAV works fine in Chrome extensions
  fs2.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filePath} (${buffer.length} bytes)`);
}

console.log('All sounds generated!');
