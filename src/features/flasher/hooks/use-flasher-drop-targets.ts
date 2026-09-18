import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { OnFileDrop, OnFileDropOff } from "@/desktop/runtime";
import { getFileName } from "@/shared/utils/file-path";

type DragTarget = "none" | "flash" | "sideload";

const isImgFile = (path: string): boolean => path.toLowerCase().endsWith(".img");

const isZipFile = (path: string): boolean => path.toLowerCase().endsWith(".zip");

const isPointInRect = (x: number, y: number, rect: DOMRect): boolean =>
  x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

export const useFlasherDropTargets = ({
  flashSectionRef,
  sideloadSectionRef,
  setFilePath,
  setSideloadFilePath,
}: {
  flashSectionRef: React.RefObject<HTMLDivElement | null>;
  setFilePath: (v: string) => void;
  setSideloadFilePath: (v: string) => void;
  sideloadSectionRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const [dragTarget, setDragTarget] = useState<DragTarget>("none");
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    OnFileDrop({
      onCancel: () => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        setDragTarget("none");
      },
      onDrop: (paths, x, y) => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        setDragTarget("none");
        if (paths.length === 0) {
          return;
        }

        // Hit-test which zone (if any) received the drop
        const flashRect = flashSectionRef.current?.getBoundingClientRect();
        const sideloadRect = sideloadSectionRef.current?.getBoundingClientRect();
        const overFlash = flashRect ? isPointInRect(x, y, flashRect) : false;
        const overSideload = sideloadRect ? isPointInRect(x, y, sideloadRect) : false;
        if (!(overFlash || overSideload)) {
          return;
        }

        let lastImg = "";
        let lastZip = "";
        for (const p of paths) {
          if (isImgFile(p)) {
            lastImg = p;
          } else if (isZipFile(p)) {
            lastZip = p;
          }
        }

        if (overFlash) {
          if (lastImg) {
            setFilePath(lastImg);
            toast.info(`Image selected: ${getFileName(lastImg)}`);
          } else {
            toast.error("Unsupported file type", {
              description: "Only .img files are accepted in the flash zone.",
            });
          }
          return;
        }

        if (lastZip) {
          setSideloadFilePath(lastZip);
          toast.info(`ZIP selected: ${getFileName(lastZip)}`);
        } else {
          toast.error("Unsupported file type", {
            description: "Only .zip files are accepted in the sideload zone.",
          });
        }
      },
      onHover: (x, y, paths) => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        let target: DragTarget = "none";
        const flashRect = flashSectionRef.current?.getBoundingClientRect();
        const sideloadRect = sideloadSectionRef.current?.getBoundingClientRect();
        const overFlash = flashRect ? isPointInRect(x, y, flashRect) : false;
        const overSideload = sideloadRect ? isPointInRect(x, y, sideloadRect) : false;
        if (overFlash) {
          const extensionOk = !paths || paths.length === 0 || paths.some(isImgFile);
          if (extensionOk) {
            target = "flash";
          }
        } else if (overSideload) {
          const extensionOk = !paths || paths.length === 0 || paths.some(isZipFile);
          if (extensionOk) {
            target = "sideload";
          }
        }
        setDragTarget(target);
        hoverTimeoutRef.current = setTimeout(() => setDragTarget("none"), 150);
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
};
