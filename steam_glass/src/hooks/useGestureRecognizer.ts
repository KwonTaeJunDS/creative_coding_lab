import { useEffect, useRef, useState } from 'react';
import {
  FilesetResolver,
  GestureRecognizer,
  type GestureRecognizerResult,
} from '@mediapipe/tasks-vision';

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task';

export function useGestureRecognizer() {
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let disposed = false;

    const loadRecognizer = async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });

      if (disposed) {
        recognizer.close();
        return;
      }

      recognizerRef.current = recognizer;
      setIsReady(true);
    };

    loadRecognizer().catch((error) => {
      console.error('Failed to load MediaPipe gesture recognizer', error);
    });

    return () => {
      disposed = true;
      recognizerRef.current?.close();
      recognizerRef.current = null;
    };
  }, []);

  const recognize = (
    video: HTMLVideoElement,
    timestampMs: number,
  ): GestureRecognizerResult | null => {
    if (!recognizerRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }

    return recognizerRef.current.recognizeForVideo(video, timestampMs);
  };

  return { isReady, recognize };
}
