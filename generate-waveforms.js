#!/usr/bin/env node
/**
 * Booth Ready waveform generator
 *
 * Requirements:
 * - ffmpeg installed and available in Terminal
 *
 * Usage:
 *   node generate-waveforms.js
 *
 * What it does:
 * - reads audio files from ./audio
 * - creates one SVG waveform per file into ./assets/waveforms
 * - filenames are slug-based so the site auto-loads them
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const AUDIO_DIR = path.join(ROOT, 'audio');
const WAVE_DIR = path.join(ROOT, 'assets', 'waveforms');

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function hasFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  return result.status === 0;
}

function buildWaveform(inputPath, outputPath) {
  const args = [
    '-y',
    '-i', inputPath,
    '-filter_complex',
    'aformat=channel_layouts=mono,showwavespic=s=1200x160:colors=white',
    '-frames:v', '1',
    outputPath,
  ];

  const result = spawnSync('ffmpeg', args, { encoding: 'utf8' });

  if (result.status !== 0) {
    console.error(`Failed: ${path.basename(inputPath)}`);
    console.error(result.stderr || result.stdout || 'Unknown ffmpeg error');
    return false;
  }

  return true;
}

function main() {
  if (!fs.existsSync(AUDIO_DIR)) {
    console.error('Missing ./audio folder');
    process.exit(1);
  }

  if (!hasFfmpeg()) {
    console.error('ffmpeg is not installed or not available in PATH.');
    console.error('Install ffmpeg first, then run: node generate-waveforms.js');
    process.exit(1);
  }

  ensureDir(WAVE_DIR);

  const files = fs.readdirSync(AUDIO_DIR).filter((file) =>
    /\.(mp3|wav|m4a|aiff|aif)$/i.test(file)
  );

  if (files.length === 0) {
    console.log('No supported audio files found in ./audio');
    return;
  }

  files.forEach((file) => {
    const ext = path.extname(file);
    const base = path.basename(file, ext);
    const slug = slugify(base);
    const inputPath = path.join(AUDIO_DIR, file);
    const outputPath = path.join(WAVE_DIR, `${slug}.svg`);

    const ok = buildWaveform(inputPath, outputPath);

    if (ok) {
      console.log(`Created ${path.relative(ROOT, outputPath)}`);
    }
  });

  console.log('Waveform generation complete.');
}

main();
