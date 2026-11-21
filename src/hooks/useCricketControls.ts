import { useEffect, useRef, type MutableRefObject } from 'react';
import type { CricketSceneEngine } from '../three/CricketSceneEngine';
import type { InningsRole } from '../types/game';

interface UseCricketControlsOptions {
  engineRef: MutableRefObject<CricketSceneEngine | null>;
  inningsRole: InningsRole;
  onCycleCamera: () => void;
}

export function useCricketControls({
  engineRef,
  inningsRole,
  onCycleCamera,
}: UseCricketControlsOptions) {
  const inningsRoleRef = useRef<InningsRole>(inningsRole);
  inningsRoleRef.current = inningsRole;

  const heldAimKeysRef = useRef({
    left: false,
    right: false,
    up: false,
    down: false,
  });

  useEffect(() => {
    const syncAim = () => {
      engineRef.current?.setBowlingAimInput(heldAimKeysRef.current);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      const engine = engineRef.current;
      if (!engine) return;

      const isBowling = inningsRoleRef.current === 'bowling';

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        if (isBowling) {
          heldAimKeysRef.current.left = true;
          syncAim();
        } else if (!e.repeat) {
          engine.setDirection('leg');
        }
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (isBowling) {
          heldAimKeysRef.current.up = true;
          syncAim();
        } else if (!e.repeat) {
          engine.setDirection('straight');
        }
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        if (isBowling) {
          heldAimKeysRef.current.right = true;
          syncAim();
        } else if (!e.repeat) {
          engine.setDirection('off');
        }
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        if (isBowling) {
          e.preventDefault();
          heldAimKeysRef.current.down = true;
          syncAim();
        }
      } else if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        engine.triggerSwing();
      } else if (e.code === 'KeyC' && !e.repeat) {
        e.preventDefault();
        onCycleCamera();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        heldAimKeysRef.current.left = false;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        heldAimKeysRef.current.right = false;
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        heldAimKeysRef.current.up = false;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        heldAimKeysRef.current.down = false;
      }
      syncAim();
    };

    const handleBlur = () => {
      heldAimKeysRef.current = {
        left: false,
        right: false,
        up: false,
        down: false,
      };
      syncAim();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [engineRef, onCycleCamera]);
}
