/* eslint-disable eslint/max-classes-per-file, unicorn/throw-new-error, unicorn/empty-brace-spaces */
import { Schema } from "effect";

export class DeviceNotFoundError extends Schema.TaggedError<DeviceNotFoundError>()(
  "DeviceNotFoundError",
  {
    message: Schema.String,
    serial: Schema.optional(Schema.String),
  }
) {}

export class DeviceUnauthorizedError extends Schema.TaggedError<DeviceUnauthorizedError>()(
  "DeviceUnauthorizedError",
  {
    message: Schema.String,
    serial: Schema.optional(Schema.String),
  }
) {}

export class AdbCommandError extends Schema.TaggedError<AdbCommandError>()("AdbCommandError", {
  command: Schema.String,
  message: Schema.String,
}) {}

export class IpcInvokeError extends Schema.TaggedError<IpcInvokeError>()("IpcInvokeError", {
  command: Schema.String,
  message: Schema.String,
}) {}

export class OperationCancelledError extends Schema.TaggedError<OperationCancelledError>()(
  "OperationCancelledError",
  {
    message: Schema.String,
    operationId: Schema.optional(Schema.String),
  }
) {}

export type DesktopError =
  | DeviceNotFoundError
  | DeviceUnauthorizedError
  | AdbCommandError
  | IpcInvokeError
  | OperationCancelledError;
