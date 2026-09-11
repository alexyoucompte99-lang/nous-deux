// Web Push natif (RFC 8030 / 8291 / 8292) sans librairie : P-256 (ECDH + ECDSA), HKDF, AES-128-GCM.
// Les notifs arrivent directement sur le téléphone (appli « Nous » installée sur l'écran d'accueil), sans appli tierce.
// Clés VAPID générées une fois ici et gardées dans les ScriptProperties (VAPID_D, VAPID_PUB).

// ---------- octets ----------
const u8_ = a => Uint8Array.from(a, b => b & 255);
const s8_ = a => Array.prototype.map.call(a, b => { b &= 255; return b > 127 ? b - 256 : b; });
function cat_() { let n = 0; for (const a of arguments) n += a.length; const out = new Uint8Array(n); let o = 0; for (const a of arguments) { out.set(a, o); o += a.length; } return out; }
const utf8_ = s => Uint8Array.from(unescape(encodeURIComponent(s)), c => c.charCodeAt(0));
const B64_ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function b64u_(bytes) {
  let s = '', i = 0;
  for (; i + 2 < bytes.length; i += 3) { const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]; s += B64_[n >> 18 & 63] + B64_[n >> 12 & 63] + B64_[n >> 6 & 63] + B64_[n & 63]; }
  if (i < bytes.length) { const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8); s += B64_[n >> 18 & 63] + B64_[n >> 12 & 63] + (i + 1 < bytes.length ? B64_[n >> 6 & 63] : ''); }
  return s;
}
function b64uDec_(s) {
  s = String(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const out = []; let buf = 0, bits = 0;
  for (const c of s) { const v = B64_.indexOf(c); if (v < 0) throw new Error('base64'); buf = (buf << 6) | v; bits += 6; if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); } }
  return Uint8Array.from(out);
}
const b2n_ = b => { let n = N0; for (const x of b) n = (n << N8) | BigInt(x); return n; };
const n2b_ = (n, len) => { const out = new Uint8Array(len); for (let i = len - 1; i >= 0; i--) { out[i] = Number(n & N255); n >>= N8; } return out; };

// ---------- hash / aléa (natifs Apps Script) ----------
function sha256_(bytes) { return u8_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s8_(bytes))); }
function hmac_(key, data) { return u8_(Utilities.computeHmacSha256Signature(s8_(data), s8_(key))); }
function rand_(n) {
  let out = new Uint8Array(0);
  while (out.length < n) out = cat_(out, sha256_(utf8_(Utilities.getUuid() + Utilities.getUuid() + Date.now() + Math.random())));
  return out.slice(0, n);
}

// ---------- P-256 ----------
// Pas de littéraux BigInt (0n…) : l'analyseur d'Apps Script les refuse à l'enregistrement, BigInt() passe.
const N0 = BigInt(0), N1 = BigInt(1), N2 = BigInt(2), N3 = BigInt(3), N4 = BigInt(4), N8 = BigInt(8), N120 = BigInt(120), N255 = BigInt(255);
const EC_P = BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
const EC_N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const EC_B = BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b');
const EC_G = { X: BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'), Y: BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5'), Z: N1 };
const mod_ = (a, m) => { const r = a % m; return r < N0 ? r + m : r; };
function inv_(a, m) {
  let r0 = mod_(a, m), r1 = m, s0 = N1, s1 = N0;
  while (r1 !== N0) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; }
  if (r0 !== N1) throw new Error('inverse');
  return mod_(s0, m);
}
function ecDbl_(P) {
  if (!P || P.Y === N0) return null;
  const p = EC_P, delta = P.Z * P.Z % p, gamma = P.Y * P.Y % p, beta = P.X * gamma % p;
  const alpha = N3 * mod_(P.X - delta, p) * (P.X + delta) % p;
  const X = mod_(alpha * alpha - N8 * beta, p);
  const Z = mod_((P.Y + P.Z) * (P.Y + P.Z) - gamma - delta, p);
  const Y = mod_(alpha * mod_(N4 * beta - X, p) - N8 * gamma * gamma, p);
  return { X, Y, Z };
}
function ecAdd_(P, Q) {
  if (!P) return Q; if (!Q) return P;
  const p = EC_P, z1 = P.Z * P.Z % p, z2 = Q.Z * Q.Z % p;
  const u1 = P.X * z2 % p, u2 = Q.X * z1 % p, s1 = P.Y * z2 % p * Q.Z % p, s2 = Q.Y * z1 % p * P.Z % p;
  const h = mod_(u2 - u1, p), r = mod_(s2 - s1, p);
  if (h === N0) return r === N0 ? ecDbl_(P) : null;
  const h2 = h * h % p, h3 = h2 * h % p, u1h2 = u1 * h2 % p;
  const X = mod_(r * r - h3 - N2 * u1h2, p);
  const Y = mod_(r * mod_(u1h2 - X, p) - s1 * h3, p);
  const Z = h * P.Z % p * Q.Z % p;
  return { X, Y, Z };
}
function ecMul_(k, P) { let R = null; for (let i = 255; i >= 0; i--) { R = ecDbl_(R); if ((k >> BigInt(i)) & N1) R = ecAdd_(R, P); } return R; }
function ecAffine_(P) { const zi = inv_(P.Z, EC_P), zi2 = zi * zi % EC_P; return { x: P.X * zi2 % EC_P, y: P.Y * zi2 % EC_P * zi % EC_P }; }
function ecDecode_(bytes) {
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('clé publique invalide');
  const x = b2n_(bytes.slice(1, 33)), y = b2n_(bytes.slice(33, 65));
  if (x >= EC_P || y >= EC_P || mod_(y * y - (x * x % EC_P * x - N3 * x + EC_B), EC_P) !== N0) throw new Error('point hors courbe');
  return { X: x, Y: y, Z: N1 };
}
const ecEncode_ = A => cat_([4], n2b_(A.x, 32), n2b_(A.y, 32));
function ecKeyPair_() {
  let d = N0;
  while (d === N0 || d >= EC_N) d = b2n_(rand_(32));
  return { d, pub: ecEncode_(ecAffine_(ecMul_(d, EC_G))) };
}
function ecdh_(d, pubBytes) { return n2b_(ecAffine_(ecMul_(d, ecDecode_(pubBytes))).x, 32); }
// ECDSA P-256 / SHA-256, nonce déterministe (RFC 6979). Signature brute r||s (format JWS).
function ecdsaSign_(d, msg) {
  const h = sha256_(msg), e = b2n_(h), x = n2b_(d, 32), hb = n2b_(mod_(e, EC_N), 32);
  let V = new Uint8Array(32).fill(1), K = new Uint8Array(32);
  K = hmac_(K, cat_(V, [0], x, hb)); V = hmac_(K, V);
  K = hmac_(K, cat_(V, [1], x, hb)); V = hmac_(K, V);
  for (;;) {
    V = hmac_(K, V);
    const k = b2n_(V);
    if (k > N0 && k < EC_N) {
      const r = mod_(ecAffine_(ecMul_(k, EC_G)).x, EC_N);
      const s = mod_(inv_(k, EC_N) * (e + r * d), EC_N);
      if (r !== N0 && s !== N0) return cat_(n2b_(r, 32), n2b_(s, 32));
    }
    K = hmac_(K, cat_(V, [0])); V = hmac_(K, V);
  }
}

// ---------- AES-128-GCM ----------
const AES_SBOX_ = (() => {
  const s = new Uint8Array(256), rotl = (x, k) => ((x << k) | (x >> (8 - k))) & 255;
  let p = 1, q = 1;
  do {
    p = (p ^ (p << 1) ^ (p & 0x80 ? 0x1b : 0)) & 255;
    q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 255; if (q & 0x80) q ^= 0x09;
    s[p] = q ^ rotl(q, 1) ^ rotl(q, 2) ^ rotl(q, 3) ^ rotl(q, 4) ^ 0x63;
  } while (p !== 1);
  s[0] = 0x63;
  return s;
})();
const xt_ = a => ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 255;
function aesKeys_(key) {
  const w = []; for (let i = 0; i < 4; i++) w.push([key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]]);
  let rc = 1;
  for (let i = 4; i < 44; i++) {
    let t = w[i - 1].slice();
    if (i % 4 === 0) { t = [AES_SBOX_[t[1]] ^ rc, AES_SBOX_[t[2]], AES_SBOX_[t[3]], AES_SBOX_[t[0]]]; rc = xt_(rc); }
    w.push(w[i - 4].map((b, j) => b ^ t[j]));
  }
  const rk = []; for (let r = 0; r < 11; r++) rk.push(Uint8Array.from([].concat(w[4 * r], w[4 * r + 1], w[4 * r + 2], w[4 * r + 3])));
  return rk;
}
function aesBlock_(rk, input) {
  let s = Uint8Array.from(input, (b, i) => b ^ rk[0][i]);
  for (let r = 1; r <= 10; r++) {
    const t = new Uint8Array(16);
    for (let c = 0; c < 4; c++) for (let row = 0; row < 4; row++) t[row + 4 * c] = AES_SBOX_[s[row + 4 * ((c + row) % 4)]];
    if (r < 10) for (let c = 0; c < 4; c++) {
      const a0 = t[4 * c], a1 = t[4 * c + 1], a2 = t[4 * c + 2], a3 = t[4 * c + 3];
      t[4 * c] = xt_(a0) ^ xt_(a1) ^ a1 ^ a2 ^ a3;
      t[4 * c + 1] = a0 ^ xt_(a1) ^ xt_(a2) ^ a2 ^ a3;
      t[4 * c + 2] = a0 ^ a1 ^ xt_(a2) ^ xt_(a3) ^ a3;
      t[4 * c + 3] = xt_(a0) ^ a0 ^ a1 ^ a2 ^ xt_(a3);
    }
    s = t.map((b, i) => b ^ rk[r][i]);
  }
  return s;
}
const GCM_R_ = BigInt('0xe1') << N120;
function gmul_(x, y) { let z = N0, v = y; for (let i = 127; i >= 0; i--) { if ((x >> BigInt(i)) & N1) z ^= v; v = (v & N1) ? (v >> N1) ^ GCM_R_ : v >> N1; } return z; }
// Chiffre plain (sans données associées) ; renvoie chiffré || tag (16 octets). iv : 12 octets.
function aesGcm_(key, iv, plain) {
  const rk = aesKeys_(key), H = b2n_(aesBlock_(rk, new Uint8Array(16)));
  const ctr = n => cat_(iv, n2b_(BigInt(n), 4));
  const out = new Uint8Array(plain.length);
  for (let i = 0; i < plain.length; i += 16) { const ks = aesBlock_(rk, ctr(2 + i / 16)); for (let j = 0; j < 16 && i + j < plain.length; j++) out[i + j] = plain[i + j] ^ ks[j]; }
  let g = N0;
  for (let i = 0; i < out.length; i += 16) { const blk = new Uint8Array(16); blk.set(out.slice(i, i + 16)); g = gmul_(g ^ b2n_(blk), H); }
  g = gmul_(g ^ BigInt(out.length * 8), H);
  const tag = n2b_(g ^ b2n_(aesBlock_(rk, ctr(1))), 16);
  return cat_(out, tag);
}

// ---------- Web Push ----------
// Chiffre un message pour un abonnement (RFC 8291, aes128gcm, un seul enregistrement).
function webPushBody_(plain, uaPub, auth) {
  const eph = ecKeyPair_();
  const shared = ecdh_(eph.d, uaPub);
  const ikm = hmac_(hmac_(auth, shared), cat_(utf8_('WebPush: info'), [0], uaPub, eph.pub, [1]));
  const salt = rand_(16), prk = hmac_(salt, ikm);
  const cek = hmac_(prk, cat_(utf8_('Content-Encoding: aes128gcm'), [0, 1])).slice(0, 16);
  const nonce = hmac_(prk, cat_(utf8_('Content-Encoding: nonce'), [0, 1])).slice(0, 12);
  return cat_(salt, [0, 0, 16, 0], [65], eph.pub, aesGcm_(cek, nonce, cat_(plain, [2])));
}
function vapidJwt_(aud, sub, keys) {
  const part = o => b64u_(utf8_(JSON.stringify(o)));
  const unsigned = part({ typ: 'JWT', alg: 'ES256' }) + '.' + part({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub });
  return unsigned + '.' + b64u_(ecdsaSign_(keys.d, utf8_(unsigned)));
}
// Prépare la requête HTTP d'envoi d'une notif vers un abonnement { e: endpoint, k: p256dh, a: auth }.
function webPushRequest_(sub, payloadObj, keys, contact) {
  const aud = String(sub.e).match(/^https:\/\/[^/]+/)[0];
  const body = webPushBody_(utf8_(JSON.stringify(payloadObj)), b64uDec_(sub.k), b64uDec_(sub.a));
  return {
    url: sub.e, method: 'post', contentType: 'application/octet-stream', payload: s8_(body), muteHttpExceptions: true,
    headers: { 'Content-Encoding': 'aes128gcm', 'TTL': '86400', 'Urgency': 'high', 'Authorization': 'vapid t=' + vapidJwt_(aud, contact, keys) + ', k=' + b64u_(keys.pub) },
  };
}
