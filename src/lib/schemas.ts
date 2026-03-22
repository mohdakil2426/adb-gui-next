import { z } from 'zod/v4';

export const ipv4Schema = z
  .string()
  .min(7, 'IP address is too short')
  .regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Must be a valid IPv4 address (e.g. 192.168.1.100)')
  .refine((v) => v.split('.').every((octet) => parseInt(octet) <= 255), 'Each octet must be 0–255');

export const portSchema = z
  .string()
  .regex(/^\d{4,5}$/, 'Port must be 4–5 digits')
  .refine((v) => parseInt(v) <= 65535, 'Port must be ≤ 65535')
  .refine((v) => parseInt(v) >= 1024, 'Port must be ≥ 1024');

export const wirelessAdbSchema = z.object({
  ip: ipv4Schema,
  port: portSchema,
});

export const partitionSchema = z
  .string()
  .min(1, 'Partition name cannot be empty')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Partition name may only contain letters, digits, underscores, and hyphens',
  );

export const shellCommandSchema = z
  .string()
  .min(1, 'Command cannot be empty')
  .refine(
    (v) => v.startsWith('adb ') || v.startsWith('fastboot '),
    'Command must start with "adb" or "fastboot"',
  );

export type WirelessAdbValues = z.infer<typeof wirelessAdbSchema>;
