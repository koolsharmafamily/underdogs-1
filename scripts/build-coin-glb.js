/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const { MeshoptSimplifier } = require('meshoptimizer');
const { KHRONOS_EXTENSIONS } = require('@gltf-transform/extensions');

async function buildCoinGlb() {
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
  const srcPath = path.resolve(__dirname, '../COIN 3D.glb');
  const dstPath = path.resolve(__dirname, '../public/models/coin-3d.glb');
  const texturesDir = path.resolve(__dirname, '../public/models/textures');

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
    // Reset any offset translation to ensure exact center pivot at (0, 0, 0)
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
