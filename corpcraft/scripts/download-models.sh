#!/usr/bin/env bash
# ──────────────────────────────────────────────
# Download KayKit Adventurers character models (CC0 licensed)
# Source: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
# License: CC0 1.0 Universal — Free for personal & commercial use
# ──────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/../apps/web/public/models/agents"
BASE_URL="https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf"

mkdir -p "$TARGET_DIR"

echo "Downloading KayKit Adventurers models to $TARGET_DIR ..."

# Download character models with mapping: source -> target
download_model() {
  local src="$1" dest="$2"
  echo "  $src -> $dest"
  curl -fSL "$BASE_URL/$src" -o "$TARGET_DIR/$dest"
}

download_model "Knight.glb"       "codex.glb"
download_model "Barbarian.glb"    "claude.glb"
download_model "Mage.glb"         "gemini.glb"
download_model "Rogue_Hooded.glb" "cursor.glb"
download_model "Rogue.glb"        "admin.glb"

# Download textures (models may reference them)
echo "Downloading textures..."
for tex in barbarian_texture.png knight_texture.png mage_texture.png rogue_texture.png; do
  echo "  $tex"
  curl -fSL "$BASE_URL/$tex" -o "$TARGET_DIR/$tex"
done

echo "Done! All models downloaded to $TARGET_DIR"
ls -lh "$TARGET_DIR"
