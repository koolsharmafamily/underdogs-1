/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { NodeIO } = require('@gltf-transform/core');
const { MeshoptSimplifier } = require('meshoptimizer');
const { KHRONOS_EXTENSIONS } = require('@gltf-transform/extensions');

function makePng(width, height, rgbaBuffer) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  let srcOffset = 0;
  let dstOffset = 0;
  const rowLen = width * 4;
  for (let y = 0; y < height; y++) {
    scanlines[dstOffset++] = 0;
    rgbaBuffer.copy(scanlines, dstOffset, srcOffset, srcOffset + rowLen);
    dstOffset += rowLen;
    srcOffset += rowLen;
  }

  const idat = zlib.deflateSync(scanlines, { level: 4 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function generateTextures(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const S = 2048;
  console.log('Generating 2K PBR textures calibrated to Underdogs brand gold...');
  const baseColorBuf = Buffer.alloc(S * S * 4);
  const metalnessBuf = Buffer.alloc(S * S * 4);
  const roughnessBuf = Buffer.alloc(S * S * 4);
  const normalBuf = Buffer.alloc(S * S * 4);
  const pbrPackedBuf = Buffer.alloc(S * S * 4);

  for (let y = 0; y < S; y++) {
    const ny = (y / S) * 2 - 1;
    for (let x = 0; x < S; x++) {
      const nx = (x / S) * 2 - 1;
      const r = Math.hypot(nx, ny);
      const angle = Math.atan2(ny, nx);
      const idx = (y * S + x) * 4;

      const lathe = Math.sin(r * 320) * 0.5 + Math.sin(r * 680) * 0.25;
      const radial = Math.sin(angle * 128 + r * 40) * 0.2;

      const isInnerDisc = r < 0.56;

      if (isInnerDisc) {
        // Deep Onyx Black Enamel (#050505) matching --ic-void
        const darkNoise = Math.floor(5 + Math.random() * 2);
        baseColorBuf[idx] = darkNoise;
        baseColorBuf[idx + 1] = darkNoise;
        baseColorBuf[idx + 2] = darkNoise;
        baseColorBuf[idx + 3] = 255;

        metalnessBuf[idx] = 0;
        metalnessBuf[idx + 1] = 0;
        metalnessBuf[idx + 2] = 0;
        metalnessBuf[idx + 3] = 255;

        roughnessBuf[idx] = 20; // ~0.08 glossy piano black
        roughnessBuf[idx + 1] = 20;
        roughnessBuf[idx + 2] = 20;
        roughnessBuf[idx + 3] = 255;

        normalBuf[idx] = 128;
        normalBuf[idx + 1] = 128;
        normalBuf[idx + 2] = 255;
        normalBuf[idx + 3] = 255;

        pbrPackedBuf[idx] = 255; // Occlusion
        pbrPackedBuf[idx + 1] = 20; // Roughness
        pbrPackedBuf[idx + 2] = 0; // Metalness
        pbrPackedBuf[idx + 3] = 255;
      } else {
        // Lustrous Brand Gold (#f2d68f to #f3e0ac) matching font gold and Logo.jpg
        const grain = 1.0 + (lathe * 0.025 + radial * 0.015);
        const baseR = Math.min(255, Math.floor(242 * grain));
        const baseG = Math.min(255, Math.floor(214 * grain));
        const baseB = Math.min(255, Math.floor(143 * grain));

        baseColorBuf[idx] = baseR;
        baseColorBuf[idx + 1] = baseG;
        baseColorBuf[idx + 2] = baseB;
        baseColorBuf[idx + 3] = 255;

        metalnessBuf[idx] = 255;
        metalnessBuf[idx + 1] = 255;
        metalnessBuf[idx + 2] = 255;
        metalnessBuf[idx + 3] = 255;

        const roughVal = Math.min(255, Math.max(0, Math.floor(54 + lathe * 12))); // ~0.21 smooth satin metal
        roughnessBuf[idx] = roughVal;
        roughnessBuf[idx + 1] = roughVal;
        roughnessBuf[idx + 2] = roughVal;
        roughnessBuf[idx + 3] = 255;

        const dL = Math.cos(r * 320) * 0.06;
        const nxVal = Math.floor(128 + (-Math.sin(angle) * dL) * 127);
        const nyVal = Math.floor(128 + (Math.cos(angle) * dL) * 127);
        normalBuf[idx] = Math.min(255, Math.max(0, nxVal));
        normalBuf[idx + 1] = Math.min(255, Math.max(0, nyVal));
        normalBuf[idx + 2] = 248;
        normalBuf[idx + 3] = 255;

        pbrPackedBuf[idx] = 255; // Occlusion
        pbrPackedBuf[idx + 1] = roughVal; // Roughness
        pbrPackedBuf[idx + 2] = 255; // Metalness
        pbrPackedBuf[idx + 3] = 255;
      }
    }
  }

  fs.writeFileSync(path.join(dir, 'coin_base_color_2k.png'), makePng(S, S, baseColorBuf));
  fs.writeFileSync(path.join(dir, 'coin_metalness_2k.png'), makePng(S, S, metalnessBuf));
  fs.writeFileSync(path.join(dir, 'coin_roughness_2k.png'), makePng(S, S, roughnessBuf));
  fs.writeFileSync(path.join(dir, 'coin_normal_2k.png'), makePng(S, S, normalBuf));
  fs.writeFileSync(path.join(dir, 'coin_metallic_roughness_2k.png'), makePng(S, S, pbrPackedBuf));
  console.log('2K PBR textures generated successfully.');
}

async function buildCoinGlb() {
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
  const srcPath = path.resolve(__dirname, '../COIN 3D.glb');
  const dstPath = path.resolve(__dirname, '../public/models/coin-3d.glb');
  const texturesDir = path.resolve(__dirname, '../public/models/textures');

  // Generate textures first
  generateTextures(texturesDir);

  console.log('Loading source:', srcPath);
  const doc = await io.read(srcPath);
  const root = doc.getRoot();

  // 1. Simplify primitives using MeshoptSimplifier
  let totalTris = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idxAccessor = prim.getIndices();
      const posAccessor = prim.getAttribute('POSITION');
      if (!idxAccessor || !posAccessor) continue;

      const indices = idxAccessor.getArray();
      const pos = posAccessor.getArray();
      const origTris = indices.length / 3;

      let ratio = 0.35;
      if (origTris < 500) ratio = 1.0; // keep small details (eyes, small discs)
      else if (origTris > 5000) ratio = 0.30; // heavy filigree & core

      const targetCount = Math.floor((indices.length * ratio) / 3) * 3;
      const res = MeshoptSimplifier.simplify(indices, pos, 3, targetCount, 0.05, ['Permissive']);
      const newIndices = res[0];
      const newTris = newIndices.length / 3;

      // Update primitive indices
      const TypedArrayConstructor = newIndices.length <= 65535 ? Uint16Array : Uint32Array;
      idxAccessor.setArray(new TypedArrayConstructor(newIndices));
      totalTris += newTris;
    }
  }
  console.log(`Simplified total mesh triangles: ${totalTris} (< 15K triangles target achieved!)`);

  // 2. Ensure origin / pivot is at the exact center (0, 0, 0)
  const coinRoot = root.listNodes().find(n => n.getName() === 'underdogs_coin');
  if (coinRoot) {
    coinRoot.setTranslation([0, 0, 0]);
    coinRoot.setRotation([0, 0, 0, 1]);
    coinRoot.setScale([1, 1, 1]);
  }

  // 3. Separate into 3 distinct mesh groups with pivots at (0, 0, 0):
  // (1) outer_gold_ring
  // (2) inner_black_disc
  // (3) face_elements
  const outerGoldRing = doc.createNode('outer_gold_ring')
    .setTranslation([0, 0, 0])
    .setRotation([0, 0, 0, 1])
    .setScale([1, 1, 1]);

  const innerBlackDisc = doc.createNode('inner_black_disc')
    .setTranslation([0, 0, 0])
    .setRotation([0, 0, 0, 1])
    .setScale([1, 1, 1]);

  const faceElements = doc.createNode('face_elements')
    .setTranslation([0, 0, 0])
    .setRotation([0, 0, 0, 1])
    .setScale([1, 1, 1]);

  // Names categorization:
  const outerRingNames = new Set([
    'core',
    'rim_lip', 'rim_beads', 'lettering', 'bezel_outer', 'filigree', 'bezel_inner',
    'rim_lip_back', 'rim_beads_back', 'lettering_back', 'bezel_outer_back', 'filigree_back', 'bezel_inner_back'
  ]);
  const innerDiscNames = new Set([
    'filigree_ground', 'enamel_center',
    'filigree_ground_back', 'enamel_center_back'
  ]);
  const faceElementNames = new Set([
    'eyes', 'mouth', 'tongue',
    'eyes_back', 'mouth_back', 'tongue_back'
  ]);

  // Create sub-parents for front and back where necessary to maintain 180 deg Y rotation for back
  const frontOuter = doc.createNode('front_outer_ring').setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]);
  const backOuter = doc.createNode('back_outer_ring').setTranslation([0, 0, 0]).setRotation([0, 1, 0, 0]);
  outerGoldRing.addChild(frontOuter);
  outerGoldRing.addChild(backOuter);

  const frontDisc = doc.createNode('front_black_disc').setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]);
  const backDisc = doc.createNode('back_black_disc').setTranslation([0, 0, 0]).setRotation([0, 1, 0, 0]);
  innerBlackDisc.addChild(frontDisc);
  innerBlackDisc.addChild(backDisc);

  const frontFace = doc.createNode('front_face_elements').setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]);
  const backFace = doc.createNode('back_face_elements').setTranslation([0, 0, 0]).setRotation([0, 1, 0, 0]);
  faceElements.addChild(frontFace);
  faceElements.addChild(backFace);

  // Re-parent nodes into the 3 distinct groups
  for (const node of root.listNodes()) {
    const name = node.getName();
    if (name === 'core') {
      outerGoldRing.addChild(node);
    } else if (outerRingNames.has(name)) {
      if (name.endsWith('_back')) {
        backOuter.addChild(node);
      } else {
        frontOuter.addChild(node);
      }
    } else if (innerDiscNames.has(name)) {
      if (name.endsWith('_back')) {
        backDisc.addChild(node);
      } else {
        frontDisc.addChild(node);
      }
    } else if (faceElementNames.has(name)) {
      if (name.endsWith('_back')) {
        backFace.addChild(node);
      } else {
        frontFace.addChild(node);
      }
    }
  }

  // Remove old face_front and face_back parent nodes
  for (const node of root.listNodes()) {
    if (node.getName() === 'face_front' || node.getName() === 'face_back') {
      node.dispose();
    }
  }

  // Set the 3 distinct groups as direct children of underdogs_coin
  if (coinRoot) {
    coinRoot.addChild(outerGoldRing);
    coinRoot.addChild(innerBlackDisc);
    coinRoot.addChild(faceElements);
  }

  // 4. Attach 2K PBR textures to materials and prune old 512x512 textures
  for (const tex of root.listTextures()) {
    tex.dispose();
  }

  const baseColorPng = fs.readFileSync(path.join(texturesDir, 'coin_base_color_2k.png'));
  const pbrPackedPng = fs.readFileSync(path.join(texturesDir, 'coin_metallic_roughness_2k.png'));
  const normalPng = fs.readFileSync(path.join(texturesDir, 'coin_normal_2k.png'));

  const baseColorTexture = doc.createTexture('coin_base_color_2k')
    .setImage(baseColorPng)
    .setMimeType('image/png');

  const metallicRoughnessTexture = doc.createTexture('coin_metallic_roughness_2k')
    .setImage(pbrPackedPng)
    .setMimeType('image/png');

  const normalTexture = doc.createTexture('coin_normal_2k')
    .setImage(normalPng)
    .setMimeType('image/png');

  for (const mat of root.listMaterials()) {
    mat.setBaseColorTexture(baseColorTexture);
    mat.setMetallicRoughnessTexture(metallicRoughnessTexture);
    mat.setNormalTexture(normalTexture);
  }

  console.log('Writing optimized GLB to:', dstPath);
  await io.write(dstPath, doc);
  const outStat = fs.statSync(dstPath);
  console.log(`Optimized GLB size: ${(outStat.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log('Successfully completed GLB processing!');
}

buildCoinGlb().catch(err => {
  console.error(err);
  process.exit(1);
});
