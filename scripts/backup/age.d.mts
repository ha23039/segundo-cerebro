export function encryptBytes(data: Uint8Array | string, recipient: string): Promise<Uint8Array>
export function decryptBytes(data: Uint8Array, identity: string): Promise<Uint8Array>
