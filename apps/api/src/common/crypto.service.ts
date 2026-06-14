import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { TypedConfigService } from '../config/config.module';

/**
 * AES-256-GCM encryption for sensitive columns (peer private keys, preshared
 * keys, agent tokens). Output format: base64( iv[12] | tag[16] | ciphertext ).
 *
 * The key comes from ENCRYPTION_KEY (32-byte hex). Rotating the key requires
 * re-encrypting existing rows; out of scope for MVP but the format is versioned
 * via the leading byte to allow future schemes.
 */
const VERSION = 0x01;
const IV_LEN = 12;
const TAG_LEN = 16;

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: TypedConfigService) {
    this.key = Buffer.from(config.get('ENCRYPTION_KEY'), 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const version = buf[0];
    if (version !== VERSION) throw new Error(`Unsupported ciphertext version: ${version}`);
    const iv = buf.subarray(1, 1 + IV_LEN);
    const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
    const ciphertext = buf.subarray(1 + IV_LEN + TAG_LEN);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}
