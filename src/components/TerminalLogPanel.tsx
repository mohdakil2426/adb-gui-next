import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLogStore } from '@/lib/logStore';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trash2, Copy, Logs, GripVertical, Save, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SaveLog } from '../../wailsjs/go/backend/App';

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;

export const TerminalLogPanel = () => {
    const { logs, clearLogs, isOpen, togglePanel } = useLogStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(400);
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        if (isOpen && scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [logs, isOpen]);

    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback(
        (mouseMoveEvent: MouseEvent) => {
            if (isResizing) {
                const newWidth = window.innerWidth - mouseMoveEvent.clientX;
                // Respect content min-width (400px) plus sidebar (collapsed ~80px or expanded ~280px)
                // We estimate based on a safe minimum: at least 480px for content area
                const maxAllowedWidth = Math.min(MAX_WIDTH, window.innerWidth - 480);
                if (newWidth >= MIN_WIDTH && newWidth <= maxAllowedWidth) {
                    setWidth(newWidth);
                }
            }
        },
        [isResizing]
    );

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [resize, stopResizing]);


    const handleCopy = () => {
        const text = logs.map((l: { timestamp: string; type: string; message: string; }) => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`).join('\n');
        navigator.clipboard.writeText(text);
        toast.info("Logs copied to clipboard");
    };

    const handleSave = async () => {
        const text = logs.map((l: { timestamp: string; type: string; message: string; }) => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`).join('\n');
        const toastId = toast.loading("Saving logs...");
        try {
            const prefix = 'terminal-logs';
            const path = await SaveLog(text, prefix);
            toast.success("Logs Saved", { description: `Saved to ${path}`, id: toastId });
        } catch (error) {
            console.error(error);
            toast.error("Save Failed", { description: String(error), id: toastId });
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="flex h-full border-l border-border bg-background shrink-0"
            style={{ width: `${width}px` }}
        >
            {/* Drag Handle */}
            <div
                className="w-1.5 h-full cursor-ew-resize bg-border hover:bg-primary/50 active:bg-primary transition-colors flex items-center justify-center shrink-0 select-none z-10"
                onMouseDown={startResizing}
            >
                <div className="h-4 w-1 bg-muted-foreground/20 rounded-full" />
            </div>

            <div className="flex-1 bg-zinc-950 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b border-border/10 bg-muted/5 shrink-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-100 select-none">
                        <Logs className="h-4 w-4" />
                        Logs
                    </div>
                    <div className="flex items-center gap-1">
                        {logs.length > 0 && (
                            <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={handleSave} title="Save Logs">
                                    <Save className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={handleCopy} title="Copy Logs">
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-900/30" onClick={clearLogs} title="Clear Logs">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={togglePanel} title="Close">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <ScrollArea className="flex-1 p-4 font-mono text-xs w-full" ref={scrollRef}>
                    <div className="flex flex-col gap-1.5 wrap-break-word">
                        {logs.length === 0 ? (
                            <div className="text-zinc-500 italic opacity-50 text-center mt-10 select-none">
                                No logs available...
                            </div>
                        ) : (
                            logs.map((log: { id: string; timestamp: string; type: string; message: string; }) => (
                                <div key={log.id} className="flex gap-2 group">
                                    <span className="text-zinc-500 select-none shrink-0 text-[10px] py-0.5">
                                        {log.timestamp}
                                    </span>
                                    <span className={cn(
                                        "break-all",
                                        log.type === 'error' ? "text-red-400 font-bold" :
                                            log.type === 'success' ? "text-green-400" :
                                                log.type === 'warning' ? "text-yellow-400" :
                                                    "text-blue-300"
                                    )}>
                                        <span className="mr-2 opacity-70 select-none">
                                            {log.type === 'info' && '>'}
                                            {log.type === 'success' && '✓'}
                                            {log.type === 'error' && '✗'}
                                            {log.type === 'warning' && '!'}
                                        </span>
                                        {log.message}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>
            {/* Overlay to prevent iframe interactions while dragging (if any) */}
            {isResizing && <div className="fixed inset-0 z-50 cursor-ew-resize select-none" />}
        </div>
    );
};
