/**
 * Available translation backends.
 *
 * Declared as a const object (not a TS enum) so files importing it stay
 * compatible with Node's type-stripping mode, which express-openapi's
 * route-file loader relies on when importing src/paths/*.ts under vitest.
 */
export const Transaltor = {
    APERTIUM: 'apertium',
    LIBRETRANSLATE: 'libretranslate'
} as const;

export type Transaltor = typeof Transaltor[keyof typeof Transaltor];
