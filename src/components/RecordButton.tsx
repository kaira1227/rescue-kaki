import { Mic, Square, Loader2 } from 'lucide-react';
import { RecordingState } from '@/types';

interface RecordButtonProps {
  state: RecordingState;
  onToggle: () => void;
  disabled?: boolean;
}

export function RecordButton({ state, onToggle, disabled }: RecordButtonProps) {
  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  const isIdle = state === 'idle';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Outer glow ring */}
      <div className="relative flex items-center justify-center">
        {/* Pulse background ring - only when recording */}
        {isRecording && (
          <div className="absolute inset-0 rounded-full bg-primary/20 scale-125 animate-ping" />
        )}

        <button
          type="button"
          onClick={onToggle}
          disabled={disabled || isProcessing}
          aria-label={
            isRecording ? 'Stop recording' : isProcessing ? 'Processing...' : 'Start recording'
          }
          className={[
            'relative flex items-center justify-center',
            'w-32 h-32 md:w-36 md:h-36 rounded-full',
            'border-4 transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'active:scale-95 disabled:cursor-not-allowed disabled:opacity-60',
            isIdle && 'bg-background border-primary hover:bg-primary/10 hover:scale-105',
            isRecording && 'bg-primary border-primary record-btn-recording',
            isProcessing && 'bg-muted border-muted-foreground',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {isIdle && (
            <Mic
              className="w-12 h-12 text-primary"
              strokeWidth={1.5}
            />
          )}
          {isRecording && (
            <Square
              className="w-10 h-10 text-primary-foreground fill-primary-foreground"
              strokeWidth={2}
            />
          )}
          {isProcessing && (
            <Loader2
              className="w-12 h-12 text-muted-foreground spin-animation"
              strokeWidth={1.5}
            />
          )}
        </button>
      </div>

      {/* State label */}
      <div className="text-center min-h-6">
        {isIdle && (
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-medium">
            Tap to Record
          </p>
        )}
        {isRecording && (
          <p className="text-sm text-primary uppercase tracking-widest font-semibold animate-pulse">
            ● Recording
          </p>
        )}
        {isProcessing && (
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-medium">
            Processing...
          </p>
        )}
      </div>
    </div>
  );
}
