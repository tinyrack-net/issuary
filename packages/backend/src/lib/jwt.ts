import {
  type JWK,
  type JWTPayload,
  jwtVerify,
  type KeyObject,
  SignJWT,
} from 'jose';

export function createJWT(
  payload: JWTPayload,
  algorithm: string,
  privateKey: CryptoKey | KeyObject | JWK | Uint8Array<ArrayBufferLike>,
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: algorithm, typ: 'JWT', kid: 'tinyrack' })
    .sign(privateKey);
}

export function verifyJWT<T>(
  token: string,
  publicKey: CryptoKey | KeyObject | JWK | Uint8Array<ArrayBufferLike>,
) {
  return jwtVerify<T>(token, publicKey);
}
