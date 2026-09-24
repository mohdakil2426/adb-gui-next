import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, react, vitest],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "**/.agents/**",
    "**/.github/**",
    "**/docs/**",
    "**/memory-bank/**",
    "**/src-tauri/**",
    "src/shared/charts/**",
  ],
  jsPlugins: ["@shadcn/lint"],
  overrides: [
    {
      files: ["src/shared/ui/**"],
      rules: {
        "shadcn/no-arbitrary-values": "off",
        "shadcn/no-restyle": "off",
        "shadcn/require-static-classes": "off",
      },
    },
  ],
  rules: {
    "shadcn/no-arbitrary-values": ["error", { allow: ["layout"] }],
    "shadcn/no-inline-styles": "error",
    "shadcn/no-raw-colors": "error",
    "shadcn/no-restyle": [
      "error",
      {
        allow: ["layout", "spacing", "typography", "color", "numeric", "ease-standard"],
        contracts: [
          {
            allow: [
              "layout",
              "spacing",
              "typography",
              "color",
              "shape",
              "effects",
              "motion",
              "numeric",
              "ease-standard",
            ],
            pattern: "^Card(Header|Title|Description|Content|Footer)?$",
          },
          {
            allow: [
              "layout",
              "spacing",
              "typography",
              "color",
              "shape",
              "numeric",
              "ease-standard",
            ],
            pattern: "^Skeleton$",
          },
          {
            allow: [
              "layout",
              "spacing",
              "typography",
              "color",
              "shape",
              "numeric",
              "ease-standard",
            ],
            pattern: "^Empty(Media|Content|Header|Title|Description)?$",
          },
          {
            allow: [
              "layout",
              "spacing",
              "typography",
              "color",
              "shape",
              "numeric",
              "ease-standard",
            ],
            pattern: "^TabsContent$",
          },
          {
            allow: [
              "layout",
              "spacing",
              "typography",
              "color",
              "shape",
              "effects",
              "numeric",
              "ease-standard",
            ],
            pattern: "^Input(Group|GroupInput|GroupText)?$",
          },
          {
            allow: [
              "layout",
              "spacing",
              "typography",
              "color",
              "shape",
              "effects",
              "numeric",
              "ease-standard",
            ],
            pattern: "^TooltipContent$",
          },
          {
            allow: [
              "layout",
              "spacing",
              "typography",
              "color",
              "effects",
              "numeric",
              "ease-standard",
            ],
            pattern: "^PopoverContent$",
          },
          {
            allow: [
              "layout",
              "spacing",
              "typography",
              "color",
              "shape",
              "effects",
              "numeric",
              "ease-standard",
            ],
            pattern: "^Sheet(Content|Header)$",
          },
          {
            allow: [
              "layout",
              "spacing",
              "typography",
              "color",
              "shape",
              "numeric",
              "ease-standard",
            ],
            pattern: "^Table(Cell|Head|Header|Row)$",
          },
          {
            allow: [
              "layout",
              "spacing",
              "typography",
              "color",
              "shape",
              "motion",
              "numeric",
              "ease-standard",
            ],
            pattern: "^DropdownMenuTrigger$",
          },
          {
            allow: [
              "layout",
              "spacing",
              "typography",
              "color",
              "shape",
              "numeric",
              "ease-standard",
            ],
            pattern: "^SidebarMenuButton$",
          },
          {
            allow: [
              "layout",
              "spacing",
              "typography",
              "color",
              "shape",
              "numeric",
              "ease-standard",
            ],
            pattern: "^BreadcrumbPage$",
          },
        ],
      },
    ],
    "shadcn/no-unknown-classes": ["error", { allow: ["toaster"] }],
    "shadcn/require-static-classes": "error",
  },
});
