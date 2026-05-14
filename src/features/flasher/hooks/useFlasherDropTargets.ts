import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { OnFileDrop, OnFileDropOff } from '@/desktop/runtime';
import { getFileName } from '@/shared/utils/formatting';

type DragTarget = 'none' | 'flash' | 'sideload';

function isImgFile(path: string): boolean {
  return path.toLowerCase().endsWith('.img');
}

function isZipFile(path: string): boolean {
  return path.toLowerCase().endsWith('.zip');
}

function isPointInRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function useFlasherDropTargets({
  flashSectionRef,
  sideloadSectionRef,
  setFilePath,
  setSideloadFilePath,
}: {
  flashSectionRef: React.RefObject<HTMLDivElement | null>;
  setFilePath: (v: string) => void;
  setSideloadFilePath: (v: string) => void;
  sideloadSectionRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [dragTarget, setDragTarget] = useState<DragTarget>('none');
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    OnFileDrop({
      onHover: (x, y, paths) => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        let target: DragTarget = 'none';
        const flashRect = flashSectionRef.current?.getBoundingClientRect();
        const sideloadRect = sideloadSectionRef.current?.getBoundingClientRect();
        const overFlash = flashRect ? isPointInRect(x, y, flashRect) : false;
        const overSideload = sideloadRect ? isPointInRect(x, y, sideloadRect) : false;
        if (overFlash) {
          const extensionOk = !paths || paths.length === 0 || paths.some(isImgFile);
          if (extensionOk) {
            target = 'flash';
          }
        } else if (overSideload) {
          const extensionOk = !paths || paths.length === 0 || paths.some(isZipFile);
          if (extensionOk) {
            target = 'sideload';
          }
        }
        setDragTarget(target);
        hoverTimeoutRef.current = setTimeout(() => setDragTarget('none'), 150);
      },
      onDrop: (paths) => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        setDragTarget('none');
        if (paths.length === 0) {
          return;
        }
        let lastImg = '';
        let lastZip = '';
        let rejectedCount = 0;
        for (const p of paths) {
          if (isImgFile(p)) {
            lastImg = p;
          } else if (isZipFile(p)) {
            lastZip = p;
          } else {
            rejectedCount++;
          }
        }
        if (lastImg) {
          setFilePath(lastImg);
          toast.info(`Image selected: ${getFileName(lastImg)}`);
        }
        if (lastZip) {
          setSideloadFilePath(lastZip);
          toast.info(`ZIP selected: ${getFileName(lastZip)}`);
        }
        if (rejectedCount > 0 && !lastImg && !lastZip) {
          toast.error('Unsupported file type', {
            description: 'Only .img (flash) and .zip (sideload) files are accepted.',
          });
        } else if (rejectedCount > 0) {
          toast.warning(`${rejectedCount} unsupported file(s) skipped`, {
            description: 'Only .img and .zip files are accepted.',
          });
        }
      },
      onCancel: () => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        setDragTarget('none');
      },
    });
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      OnFileDropOff();
    };
  }, [flashSectionRef, setFilePath, setSideloadFilePath, sideloadSectionRef]);

  return { dragTarget };
}
