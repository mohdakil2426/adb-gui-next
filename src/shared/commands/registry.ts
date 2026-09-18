import { shellCommands, viewCommands } from "@/shared/commands/app-commands";
import { deviceActionCommands, deviceSelectionCommands } from "@/shared/commands/device-commands";
import type { CommandAction, CommandContext, CommandGroupId } from "@/shared/commands/types";

export const COMMAND_GROUPS: { id: CommandGroupId; label: string }[] = [
  { id: "actions", label: "Actions" },
  { id: "navigate", label: "Navigate" },
  { id: "devices", label: "Devices" },
];

/**
 * The whole action surface, rebuilt whenever the context changes.
 *
 * Order inside a group is authoring order — cmdk re-ranks on search but keeps it
 * for the empty query, so the most-reached-for actions come first.
 */
export const buildCommands = (ctx: CommandContext): CommandAction[] => [
  ...deviceActionCommands(),
  ...shellCommands(ctx),
  ...viewCommands(ctx),
  ...deviceSelectionCommands(ctx),
];
