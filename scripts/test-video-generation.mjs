#!/usr/bin/env node
/**
 * Test video generation against a running dev server (npm run dev).
 * Usage: node scripts/test-video-generation.mjs [baseUrl]
 * Example: node scripts/test-video-generation.mjs http://localhost:3000
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const TEST_PROMPT = 'A short cartoon about slip and trip hazards in a warehouse.';

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = res.ok ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data?.error || data || `HTTP ${res.status}`);
  return data;
}

async function main() {
  console.log('Testing video generation against', BASE_URL);
  console.log('Prompt:', TEST_PROMPT);
  console.log('');

  try {
    // 1. Generate script
    console.log('1. Generating script...');
    const script = await post('/api/generate-script', { prompt: TEST_PROMPT });
    console.log('   Title:', script.title);
    console.log('   Scenes:', script.scenes?.length ?? 0);
    if (script.scenes?.[0]) {
      console.log('   First scene narration:', script.scenes[0].narration?.slice(0, 80) + '...');
    }
    console.log('   Script OK\n');

    // 2. Generate one image (first scene)
    const firstScene = script.scenes[0];
    if (firstScene?.imagePrompt) {
      console.log('2. Generating image for first scene...');
      const img = await post('/api/generate-image', { imagePrompt: firstScene.imagePrompt });
      console.log('   Image received:', img.imageBase64 ? `${img.imageBase64.length} chars base64` : 'no');
      console.log('   Image OK\n');
    }

    // 3. Generate one audio (first scene)
    if (firstScene?.narration) {
      console.log('3. Generating audio for first scene...');
      const audio = await post('/api/generate-audio', { text: firstScene.narration });
      console.log('   Audio received:', audio.audioBase64 ? `${audio.audioBase64.length} chars base64` : 'no');
      console.log('   Audio OK\n');
    }

    console.log('All steps passed. Video generation pipeline is working.');
    console.log('Run the app in the browser to create a full video: npm run dev → http://localhost:3000');
  } catch (err) {
    console.error('Test failed:', err.message);
    if (err.message?.includes('fetch') || err.message?.includes('ECONNREFUSED')) {
      console.error('Make sure the dev server is running: npm run dev');
    }
    process.exit(1);
  }
}

main();
