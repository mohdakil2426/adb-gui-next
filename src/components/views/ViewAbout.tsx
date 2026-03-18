import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, Globe, Heart, Coffee, ExternalLink, Code2, Rocket, Smartphone, Send } from "lucide-react";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";

export function ViewAbout({ activeView }: { activeView: string }) {

    const openLink = (url: string) => {
        BrowserOpenURL(url);
    };

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Hero Section */}
            <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                    <img src="/logo.png" alt="Logo" className="relative w-24 h-24 object-contain" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        ADBKit
                    </h1>
                    <span className="bg-linear-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent font-extrabold text-2xl sm:text-4xl pt-2">
                        Enhanced
                    </span>
                    <p className="text-muted-foreground text-base sm:text-lg max-w-[600px] px-4">
                        The modern, lightweight, and powerful GUI for Android Debug Bridge and Fastboot tools.
                    </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                        v2.0.0 Enhanced
                    </span>
                    <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm font-medium border border-border">
                        Open Source
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Project Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Rocket className="w-5 h-5 text-primary" />
                            Mission
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground">
                            ADBKit exists to make Android debugging accessible to everyone. Whether you're a developer needing quick access to shell commands, or an enthusiast rooting your device, we believe the tools should be as modern as the phones they manage.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Smartphone className="w-4 h-4" />
                                <span>Device Management</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Code2 className="w-4 h-4" />
                                <span>Terminal Shell</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Community & Links */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Globe className="w-5 h-5 text-primary" />
                            Connect
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-2">
                            <Button variant="outline" className="justify-start gap-2 h-auto min-h-12 py-2" onClick={() => openLink("https://github.com/mohdakil2426/adb-gui-kit-enhanced")}>
                                <Github className="w-5 h-5 shrink-0" />
                                <div className="flex flex-col items-start min-w-0 flex-1">
                                    <span className="font-semibold truncate w-full text-left">GitHub Repository</span>
                                    <span className="text-xs text-muted-foreground truncate w-full text-left">Source code, issues & contributions</span>
                                </div>
                                <ExternalLink className="w-4 h-4 ml-auto shrink-0 text-muted-foreground" />
                            </Button>

                            <Button variant="outline" className="justify-start gap-2 h-auto min-h-12 py-2" onClick={() => openLink("https://github.com/Drenzzz/adb-gui-kit")}>
                                <Github className="w-5 h-5 shrink-0" />
                                <div className="flex flex-col items-start min-w-0 flex-1">
                                    <span className="font-semibold truncate w-full text-left">Original Project</span>
                                    <span className="text-xs text-muted-foreground truncate w-full text-left">ADBKit by Drenzzz</span>
                                </div>
                                <ExternalLink className="w-4 h-4 ml-auto shrink-0 text-muted-foreground" />
                            </Button>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3 border border-border/50">
                            <Heart className="w-5 h-5 text-red-500 fill-red-500/20" />
                            <div className="flex-1">
                                <p className="text-sm font-medium">Built with love</p>
                                <p className="text-xs text-muted-foreground">Powered by Wails, React & Go</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

            </div>

            {/* Credits / Footer */}
            <div className="text-center text-sm text-muted-foreground py-6 space-y-1">
                <p>Original project by <a href="https://github.com/Drenzzz/adb-gui-kit" className="font-semibold text-foreground hover:underline cursor-pointer" onClick={() => openLink("https://github.com/Drenzzz/adb-gui-kit")}>Drenzzz</a></p>
                <p>Enhanced by <a href="https://github.com/mohdakil2426" className="font-semibold text-foreground hover:underline cursor-pointer" onClick={() => openLink("https://github.com/mohdakil2426")}>AKIL</a> © 2025</p>
            </div>
        </div >
    );
}
