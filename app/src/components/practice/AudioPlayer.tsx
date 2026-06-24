/**
 * Audio Player Component
 * Text-to-speech controls for hands-free practice
 */

import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Square, Volume2, VolumeX, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { tts, createTTSStateListener, type TTSOptions } from '@/lib/audio/tts';

interface AudioPlayerProps {
  question: string;
  answer?: string;
  className?: string;
}

export function AudioPlayer({ question, answer, className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(0.9);
  const [volume, setVolume] = useState(1);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    setIsSupported(tts.isAvailable());
    
    // Listen for state changes
    const unsubscribe = createTTSStateListener((state) => {
      setIsPlaying(state.isPlaying);
      setIsPaused(state.isPaused);
    });

    // Preload voices
    tts.preload();

    return () => {
      unsubscribe();
      tts.stop();
    };
  }, []);

  const handlePlay = useCallback(() => {
    const options: TTSOptions = {
      rate,
      volume,
    };
    tts.speakQA(question, answer, options);
  }, [question, answer, rate, volume]);

  const handlePause = useCallback(() => {
    if (isPaused) {
      tts.resume();
    } else {
      tts.pause();
    }
  }, [isPaused]);

  const handleStop = useCallback(() => {
    tts.stop();
  }, []);

  if (!isSupported) {
    return (
      <Card className={cn('border-slate-200/60', className)}>
        <CardContent className="p-4 text-center">
          <VolumeX className="w-5 h-5 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            Audio mode is not supported in your browser
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-slate-200/60', className)}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Headphones className="w-5 h-5 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Audio Mode</span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <Button
              onClick={handlePlay}
              size="sm"
              className="bg-slate-700 hover:bg-slate-800"
            >
              <Play className="w-4 h-4 mr-1" />
              Play
            </Button>
          ) : (
            <>
              <Button
                onClick={handlePause}
                size="sm"
                variant="outline"
              >
                {isPaused ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                onClick={handleStop}
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700"
              >
                <Square className="w-4 h-4 mr-1" />
                Stop
              </Button>
            </>
          )}
        </div>

        {/* Settings */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          {/* Speed Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Speed</span>
              <span className="text-slate-700">{rate.toFixed(1)}x</span>
            </div>
            <Slider
              value={[rate]}
              onValueChange={([v]) => setRate(v)}
              min={0.5}
              max={1.5}
              step={0.1}
            />
          </div>

          {/* Volume Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Volume</span>
              <span className="text-slate-700">{Math.round(volume * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <VolumeX className="w-3 h-3 text-slate-400" />
              <Slider
                value={[volume]}
                onValueChange={([v]) => setVolume(v)}
                min={0}
                max={1}
                step={0.1}
                className="flex-1"
              />
              <Volume2 className="w-3 h-3 text-slate-400" />
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Great for practicing while driving or doing chores
        </p>
      </CardContent>
    </Card>
  );
}
