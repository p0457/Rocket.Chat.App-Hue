import { Md5 } from "./ts-md5/md5";

export function calculateDigestResponse(clientId: string, clientSecret: string, realm: string, verb: string, path: string, nonce: string) {
  const preHash1 = `${clientId}:${realm}:${clientSecret}`;
  const preHash2 = `${verb}:${path}`;

  const hash1 = Md5.hashStr(preHash1);
  const hash2 = Md5.hashStr(preHash2);

  const preHashFinal = `${hash1}:${nonce}:${hash2}`;
  const hashFinal = Md5.hashStr(preHashFinal);
  return hashFinal;
}

export function createDigestHeader(clientId: string, clientSecret: string, realm: string, verb: string, path: string, nonce: string) {
  const digestResponse = this.calculateDigestResponse(clientId, clientSecret, realm, verb, path, nonce);
  const digestHeaderContent = `Digest username="${clientId}", ` +
    `realm="${realm}", nonce="${nonce}", ` +
    `uri="/oauth2/token", response="${digestResponse}"`;

  return digestHeaderContent;
}