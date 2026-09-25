import type { ComponentNode } from '../core/types.js';
export declare function friendlyElementLabel(node: ComponentNode | null | undefined, fallback?: string): string;
export declare function tokenStem(name: string): string;
export declare function friendlyTokenLabel(name: string): string;
export declare function sortColorTokenEntries(colors: Record<string, string>): Array<[string, string]>;
