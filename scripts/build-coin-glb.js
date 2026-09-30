/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const { KHRONOS_EXTENSIONS } = require('@gltf-transform/extensions');

/**
 * Builds the production 3D coin GLB (/public/models/coin-3d.glb) from the new
 * master 3D coin model (underdogs-coin new.glb).
 *
 * Preserves the 3D artist's new materials (gold_brushed, gold_polished,
 * gold_lettering, enamel_black) and embedded textures, resets the pivot to
 * exact center (0, 0, 0), and organizes meshes into 3 semantic groups
 * (outer_gold_ring, inner_black_disc, face_elements) so CoinRig can drive
 * independent parallax, roll, and Goldie's face animations.
 */
async function buildCoinGlb() {
  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
  const srcPath = path.resolve(__dirname, '../underdogs-coin new.glb');
  const dstPath = path.resolve(__dirname, '../public/models/coin-3d.glb');

  console.log('Loading source:', srcPath);
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Source GLB not found at ${srcPath}`);
  }

  const doc = await io.read(srcPath);
  const root = doc.getRoot();

  // 1. Ensure origin / pivot is at the exact center (0, 0, 0)
  const coinRoot = root.listNodes().find((n) => n.getName() === 'underdogs_coin');
  if (coinRoot) {
    coinRoot.setTranslation([0, 0, 0]);
    coinRoot.setRotation([0, 0, 0, 1]);
    coinRoot.setScale([1, 1, 1]);
  }

  // 2. Create 3 distinct semantic groups with pivots at (0, 0, 0):
  // (1) outer_gold_ring
  // (2) inner_black_disc
  // (3) face_elements
  const outerGoldRing = doc
    .createNode('outer_gold_ring')
    .setTranslation([0, 0, 0])
    .setRotation([0, 0, 0, 1])
    .setScale([1, 1, 1]);

  const innerBlackDisc = doc
    .createNode('inner_black_disc')
    .setTranslation([0, 0, 0])
    .setRotation([0, 0, 0, 1])
    .setScale([1, 1, 1]);

  const faceElements = doc
    .createNode('face_elements')
    .setTranslation([0, 0, 0])
    .setRotation([0, 0, 0, 1])
    .setScale([1, 1, 1]);

  // Names categorization:
  const outerRingNames = new Set([
    'core',
    'rim_lip',
    'rim_beads',
    'lettering',
    'bezel_outer',
    'filigree',
    'bezel_inner',
    'rim_lip_back',
    'rim_beads_back',
    'lettering_back',
    'bezel_outer_back',
    'filigree_back',
    'bezel_inner_back',
  ]);
  const innerDiscNames = new Set([
    'filigree_ground',
    'enamel_center',
    'filigree_ground_back',
    'enamel_center_back',
  ]);
  const faceElementNames = new Set([
    'eyes',
    'mouth',
    'tongue',
    'eyes_back',
    'mouth_back',
    'tongue_back',
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

  console.log('Writing optimized GLB to:', dstPath);
  await io.write(dstPath, doc);
  const outStat = fs.statSync(dstPath);
  console.log(`GLB size: ${(outStat.size / (1024 * 1024)).toFixed(2)} MB (${outStat.size} bytes)`);
  console.log('Successfully completed GLB processing from underdogs-coin new.glb!');
}

buildCoinGlb().catch((err) => {
  console.error(err);
  process.exit(1);
});
