"""Lossless runtime subsets of the authored six-dog kit; no Blender re-export required."""
import argparse
import copy
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BREEDS = {"corgi": "Mochi", "shiba": "Kiko", "beagle": "Biscuit", "samoyed": "Cloud", "collie": "Fern", "shepherd": "Atlas"}


def read_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", data)
    assert magic == 0x46546C67 and version == 2 and length == len(data)
    size, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4E4F534A
    document = json.loads(data[20:20 + size])
    size_bin, kind_bin = struct.unpack_from("<II", data, 20 + size)
    assert kind_bin == 0x004E4942
    return document, data[28 + size:28 + size + size_bin]


def subset(document, binary, name):
    # This kit has no texture images or extension-owned buffer references.
    assert not document.get("images") and not document.get("extensionsUsed")
    root = next(i for i in document["scenes"][0]["nodes"] if document["nodes"][i]["name"] == name)
    retained = set()
    def visit(index):
        retained.add(index)
        for child in document["nodes"][index].get("children", []):
            visit(child)
    visit(root)
    indices = sorted(retained)
    nodes = {old: new for new, old in enumerate(indices)}
    result = {"asset": copy.deepcopy(document["asset"]), "scene": 0, "scenes": [{"nodes": [nodes[root]]}],
              "nodes": [], "meshes": [], "skins": [], "animations": [], "accessors": [], "bufferViews": [],
              "materials": copy.deepcopy(document["materials"])}
    packed = bytearray()
    accessors, views, shared_views = {}, {}, {}
    def accessor(index):
        if index in accessors:
            return accessors[index]
        entry = copy.deepcopy(document["accessors"][index])
        assert "sparse" not in entry
        old_view = entry["bufferView"]
        if old_view not in views:
            view = copy.deepcopy(document["bufferViews"][old_view])
            assert view["buffer"] == 0
            offset = view.pop("byteOffset", 0)
            payload = binary[offset:offset + view["byteLength"]]
            key = (json.dumps(view, sort_keys=True), payload)
            # Repeated constant animation data is byte-identical and can share a view.
            if key not in shared_views:
                packed.extend(b"\x00" * (-len(packed) % 4))
                view["byteOffset"] = len(packed)
                packed.extend(payload)
                shared_views[key] = len(result["bufferViews"])
                result["bufferViews"].append(view)
            views[old_view] = shared_views[key]
        entry["bufferView"] = views[old_view]
        accessors[index] = len(result["accessors"])
        result["accessors"].append(entry)
        return accessors[index]
    mesh_map, skin_map = {}, {}
    for old in indices:
        node = copy.deepcopy(document["nodes"][old])
        if "children" in node:
            node["children"] = [nodes[i] for i in node["children"]]
        if "mesh" in node:
            original = node["mesh"]
            if original not in mesh_map:
                mesh = copy.deepcopy(document["meshes"][original])
                for primitive in mesh["primitives"]:
                    primitive["attributes"] = {key: accessor(value) for key, value in primitive["attributes"].items()}
                    if "indices" in primitive:
                        primitive["indices"] = accessor(primitive["indices"])
                    assert not primitive.get("targets")
                mesh_map[original] = len(result["meshes"])
                result["meshes"].append(mesh)
            node["mesh"] = mesh_map[original]
        if "skin" in node:
            original = node["skin"]
            if original not in skin_map:
                skin = copy.deepcopy(document["skins"][original])
                skin["joints"] = [nodes[i] for i in skin["joints"]]
                if "skeleton" in skin:
                    skin["skeleton"] = nodes[skin["skeleton"]]
                skin["inverseBindMatrices"] = accessor(skin["inverseBindMatrices"])
                skin_map[original] = len(result["skins"])
                result["skins"].append(skin)
            node["skin"] = skin_map[original]
        result["nodes"].append(node)
    for animation in document["animations"]:
        if not animation["name"].startswith(name + "_"):
            continue
        animation = copy.deepcopy(animation)
        for channel in animation["channels"]:
            channel["target"]["node"] = nodes[channel["target"]["node"]]
        for sampler in animation["samplers"]:
            sampler["input"] = accessor(sampler["input"])
            sampler["output"] = accessor(sampler["output"])
        result["animations"].append(animation)
    assert len(result["animations"]) == 10 and len(result["skins"]) == 1
    result["buffers"] = [{"byteLength": len(packed)}]
    encoded = json.dumps(result, separators=(",", ":"), ensure_ascii=False).encode()
    encoded += b" " * (-len(encoded) % 4)
    packed.extend(b"\x00" * (-len(packed) % 4))
    return (struct.pack("<III", 0x46546C67, 2, 28 + len(encoded) + len(packed))
            + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
            + struct.pack("<II", len(packed), 0x004E4942) + packed)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify checked-in subsets without writing files")
    args = parser.parse_args()
    document, binary = read_glb(ROOT / "public/village/models/puppies.glb")
    for breed, name in BREEDS.items():
        data = subset(document, binary, name)
        destination = ROOT / f"public/village/models/puppies/{breed}.glb"
        if args.check:
            assert destination.read_bytes() == data, f"Stale or changed runtime puppy: {breed}"
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        print(f"{breed}: {len(data):,} bytes, original geometry and all ten animations")


if __name__ == "__main__":
    main()
