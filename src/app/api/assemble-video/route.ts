/**
 * Video assembly endpoint - combines scene images/videos with audio into final MP4.
 * 
 * Features:
 * - Supports both static images and video clips (Tier 3)
 * - Timed captions with word-weighted synchronization (longer phrases = proportionally longer display)
 * - Smooth fade transitions between scenes
 * - Uses ffmpeg-static for consistent cross-platform support
 * 
 * Caption system:
 * - Narration is split into segments (sentences or word-wrapped chunks, max 45 chars)
 * - Each segment's display duration is proportional to its word count
 * - Uses FFmpeg drawtext filter with enable='between(t,start,end)' for timing
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import ffmpegStaticPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-errors';
import {
  MIN_SCENE_DURATION,
  FADE_DURATION,
  OUTPUT_WIDTH,
  OUTPUT_HEIGHT,
  VIDEO_BITRATE,
  MAX_ASSEMBLE_BODY_BYTES,
  ASSEMBLE_VIDEO_TIMEOUT_MS,
  MAX_CAPTION_LENGTH,
} from '@/lib/constants';
import { assembleVideoBodySchema, formatValidationErrors } from '@/lib/schemas';
import { withTimeout } from '@/lib/timeout';
import { withApiHandler } from '@/lib/with-api-handler';

// Import ffmpeg-static at module level for proper bundling

// Use ffmpeg-static binary - required for drawtext filter support
function getFfmpegPath(): string {
  // Check if ffmpeg-static path is valid
  if (ffmpegStaticPath && typeof ffmpegStaticPath === 'string' && fs.existsSync(ffmpegStaticPath)) {
    console.warn(`[assemble-video] Using ffmpeg-static: ${ffmpegStaticPath}`);
    return ffmpegStaticPath;
  }
  
  // Try common paths for ffmpeg-static
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    path.join(process.cwd(), 'node_modules', '.pnpm', 'ffmpeg-static@5.2.0', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.warn(`[assemble-video] Using ffmpeg-static (fallback): ${p}`);
      return p;
    }
  }
  
  // Fallback to system ffmpeg (may not have all filters like drawtext)
  console.warn('[assemble-video] Warning: ffmpeg-static not found, using system ffmpeg (captions may not work)');
  return 'ffmpeg';
}

/** Format seconds as SRT timestamp (HH:MM:SS,mmm). */
function toSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/** Build SRT content for one subtitle (full segment duration). */
function _buildSrtContent(caption: string, durationSeconds: number): string {
  const start = toSrtTime(0);
  const end = toSrtTime(durationSeconds);
  const line = caption.replace(/\s+/g, ' ').trim().slice(0, MAX_CAPTION_LENGTH);
  return `1\n${start} --> ${end}\n${line}\n\n`;
}

async function handleAssembleVideo(request: Request): Promise<NextResponse> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_ASSEMBLE_BODY_BYTES) {
    return NextResponse.json(
      apiError('Request body too large', { code: 'BAD_REQUEST' }),
      { status: 413 }
    );
  }

  const tmpDir = path.join(os.tmpdir(), `safety-video-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const cleanup = () => {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.readdirSync(tmpDir).forEach((f) => fs.unlinkSync(path.join(tmpDir, f)));
        fs.rmdirSync(tmpDir);
      }
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  };

  try {
    const body = await request.json();
    const parseResult = assembleVideoBodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(formatValidationErrors(parseResult), { status: 400 });
    }
    const { scenes, captions } = parseResult.data;

    console.warn(`[assemble-video] Captions enabled: ${captions}, Scene count: ${scenes.length}`);

    const captionTexts = scenes.map((s) =>
      s.narration != null
        ? String(s.narration)
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/\0/g, '')
            .slice(0, MAX_CAPTION_LENGTH)
        : ''
    );

    console.warn(`[assemble-video] Caption texts:`, captionTexts.map((t, i) => `Scene ${i}: ${t.length > 0 ? t.slice(0, 50) + '...' : '(empty)'}`));

    const ffmpegPath = getFfmpegPath();
    ffmpeg.setFfmpegPath(ffmpegPath);

    const segmentPaths: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const { imageBase64, videoBase64, audioBase64, durationSeconds, narration } = scenes[i];
      const hasImage = !!imageBase64;
      const hasVideo = !!videoBase64;
      if ((!hasImage && !hasVideo) || !audioBase64 || durationSeconds <= 0) {
        return NextResponse.json(
          apiError(`Scene ${i}: either imageBase64 or videoBase64 required, plus audioBase64 and durationSeconds`, {
            code: 'BAD_REQUEST',
            details: { sceneIndex: i },
          }),
          { status: 400 }
        );
      }
      if (hasImage && hasVideo) {
        return NextResponse.json(
          apiError(`Scene ${i}: cannot have both imageBase64 and videoBase64`, {
            code: 'BAD_REQUEST',
            details: { sceneIndex: i },
          }),
          { status: 400 }
        );
      }

      const effectiveDuration = Math.max(durationSeconds, MIN_SCENE_DURATION);
      const fadeOutStart = effectiveDuration - FADE_DURATION;

      // Use generic audio extension - FFmpeg will auto-detect format
      const audioPath = path.join(tmpDir, `scene-${i}.audio`);
      const segmentPath = path.join(tmpDir, `segment-${i}.mp4`);
      fs.writeFileSync(audioPath, Buffer.from(audioBase64, 'base64'));
      console.warn(`[assemble-video] Scene ${i}: Audio file size: ${Buffer.from(audioBase64, 'base64').length} bytes`);

      const scalePad =
        `scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,` +
        `pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2`;
      const fades = `fade=t=in:st=0:d=${FADE_DURATION},fade=t=out:st=${fadeOutStart}:d=${FADE_DURATION}`;

      const baseVf = `${scalePad},${fades}`;
      let vf = baseVf;
      const captionForScene = captionTexts[i] ?? (narration != null ? String(narration).trim() : '');
      const useCaptions = captions && captionForScene.length > 0;
      
      // For captions, we'll use timed segments that transition throughout the scene
      if (useCaptions) {
        // Split text into timed segments - max 45 chars per segment to ensure fit
        const maxCharsPerSegment = 45;
        const segments: string[] = [];
        
        // First try to split by sentences
        const sentences = captionForScene.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
        
        // Process each sentence - if too long, split it further
        for (const sentence of sentences) {
          if (sentence.length <= maxCharsPerSegment) {
            segments.push(sentence.trim());
          } else {
            // Split long sentence into chunks at word boundaries
            const words = sentence.split(' ');
            let currentChunk = '';
            
            for (const word of words) {
              if (currentChunk.length + word.length + 1 <= maxCharsPerSegment) {
                currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
              } else {
                if (currentChunk) segments.push(currentChunk.trim());
                currentChunk = word;
              }
            }
            if (currentChunk) segments.push(currentChunk.trim());
          }
        }
        
        // If no sentences found (no punctuation), split the whole text
        if (segments.length === 0) {
          const words = captionForScene.split(' ');
          let currentChunk = '';
          
          for (const word of words) {
            if (currentChunk.length + word.length + 1 <= maxCharsPerSegment) {
              currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
            } else {
              if (currentChunk) segments.push(currentChunk.trim());
              currentChunk = word;
            }
          }
          if (currentChunk) segments.push(currentChunk.trim());
        }
        
        // Calculate timing for each segment based on WORD COUNT (longer segments = more time)
        // This better approximates natural speech rhythm
        const wordCounts = segments.map(s => s.split(' ').length);
        const totalWords = wordCounts.reduce((a, b) => a + b, 0);
        
        // Calculate start/end times proportionally by word count
        const segmentTimings: { start: number; end: number }[] = [];
        let currentTime = 0;
        
        for (let idx = 0; idx < segments.length; idx++) {
          const segmentProportion = wordCounts[idx] / totalWords;
          const segmentDuration = effectiveDuration * segmentProportion;
          segmentTimings.push({
            start: currentTime,
            end: currentTime + segmentDuration,
          });
          currentTime += segmentDuration;
        }
        
        // Escape text for FFmpeg drawtext filter
        const escapeForDrawtext = (text: string) => text
          .replace(/\\/g, '\\\\')
          .replace(/'/g, '')
          .replace(/"/g, '')
          .replace(/:/g, '\\:')
          .replace(/\n/g, ' ')
          .replace(/\r/g, '');
        
        // Build timed drawtext filters - each segment appears proportionally to its word count
        // Font size 28pt for better fit, positioned at y=980 (safe zone), with background box
        const fontSize = 28;
        const yPos = 980;
        
        const drawFilters = segments.map((segment, idx) => {
          const { start, end } = segmentTimings[idx];
          const escaped = escapeForDrawtext(segment);
          
          // Use enable expression to show segment only during its time window
          return `drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black:box=1:boxcolor=black@0.6:boxborderw=8:x=(w-text_w)/2:y=${yPos}:enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`;
        });
        
        vf = `${baseVf},${drawFilters.join(',')}`;
        console.warn(`[assemble-video] Scene ${i}: Timed captions: ${segments.length} segments (word-weighted)`);
        console.warn(`[assemble-video] Scene ${i}: Timings: ${segmentTimings.map((t, idx) => `[${idx}] ${t.start.toFixed(1)}-${t.end.toFixed(1)}s (${wordCounts[idx]} words)`).join(', ')}`);
      }

      const runSegment = (filterChain: string, inputSpec: { path: string; isVideo: boolean }) =>
        new Promise<void>((resolve, reject) => {
          const cmd = ffmpeg();
          if (inputSpec.isVideo) {
            cmd.input(inputSpec.path).inputOptions(['-stream_loop', '-1']);
          } else {
            cmd.input(inputSpec.path).inputOptions(['-loop', '1']);
          }
          
          // Note: -vf must be separate from filter value for proper parsing
          const outputOpts = [
            '-c:v', 'libx264',
            '-b:v', VIDEO_BITRATE,
            '-t', String(effectiveDuration),
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-vf', filterChain,
            '-shortest',
          ];
          
          console.warn(`[assemble-video] Scene ${i}: Running FFmpeg`);
          console.warn(`[assemble-video]   Input: ${inputSpec.path} (isVideo: ${inputSpec.isVideo})`);
          console.warn(`[assemble-video]   Audio: ${audioPath}`);
          console.warn(`[assemble-video]   Output: ${segmentPath}`);
          console.warn(`[assemble-video]   Filter: ${filterChain.slice(0, 200)}...`);
          
          cmd
            .input(audioPath)
            .outputOptions(outputOpts)
            .output(segmentPath)
            .on('start', (cmdLine: string) => {
              console.warn(`[assemble-video] Scene ${i}: FFmpeg command: ${cmdLine.slice(0, 500)}...`);
            })
            .on('end', () => resolve())
            .on('error', (err: Error) => reject(err))
            .run();
        });

      const tryRunSegment = async (filterChain: string, inputSpec: { path: string; isVideo: boolean }) => {
        try {
          await runSegment(filterChain, inputSpec);
          console.warn(`[assemble-video] Scene ${i}: Segment created successfully`);
        } catch (segmentErr) {
          const msg = segmentErr instanceof Error ? segmentErr.message : String(segmentErr);
          console.warn(`[assemble-video] Scene ${i} filter failed: ${msg}`);
          
          // If caption filter fails, try without captions
          if (useCaptions && filterChain !== baseVf) {
            console.warn(`[assemble-video] Scene ${i}: Retrying without captions`);
            try {
              await runSegment(baseVf, inputSpec);
              console.warn(`[assemble-video] Scene ${i}: Succeeded without captions`);
            } catch (noCaptionErr) {
              console.warn(`[assemble-video] Scene ${i}: Still failing without captions: ${noCaptionErr instanceof Error ? noCaptionErr.message : noCaptionErr}`);
              throw noCaptionErr;
            }
          } else {
            throw segmentErr;
          }
        }
      };

      if (hasImage) {
        const imgPath = path.join(tmpDir, `scene-${i}.png`);
        fs.writeFileSync(imgPath, Buffer.from(imageBase64!, 'base64'));
        await tryRunSegment(vf, { path: imgPath, isVideo: false });
      } else {
        const videoPath = path.join(tmpDir, `scene-${i}.mp4`);
        fs.writeFileSync(videoPath, Buffer.from(videoBase64!, 'base64'));
        await tryRunSegment(vf, { path: videoPath, isVideo: true });
      }

      segmentPaths.push(segmentPath);
    }

    const listPath = path.join(tmpDir, 'list.txt');
    fs.writeFileSync(
      listPath,
      segmentPaths.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n')
    );

    const outputPath = path.join(tmpDir, 'output.mp4');

    await withTimeout(
      new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(listPath)
          .inputOptions(['-f concat', '-safe 0'])
          .outputOptions(['-c copy'])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      }),
      ASSEMBLE_VIDEO_TIMEOUT_MS,
      'Video assembly timed out'
    );

    const videoBuffer = fs.readFileSync(outputPath);

    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="safety-training-video.mp4"',
      },
    });
  } catch (err) {
    throw err;
  } finally {
    cleanup();
  }
}

export const POST = withApiHandler('assemble-video', handleAssembleVideo);
