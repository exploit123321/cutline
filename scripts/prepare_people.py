"""
Make the Meshy people GLBs light enough for the web.

Source: the author's own Meshy AI models, rigged with a Mixamo skeleton, curated in
D:\\tsak\\meshy-library\\curated\\people. For each model this script:
  - re-encodes the 4096 px PNG texture as a 2048 px JPEG (the material is opaque),
  - drops the animations (the show poses the bones itself),
  - turns the self-lit material into a plain lit one: no emissive copy of the texture,
    metalness 0, a cloth-like roughness, and no specular or IOR extensions,
  - repacks the binary chunk so only the data still in use is kept.

usage: python -I scripts/prepare_people.py <source.glb> <out.glb> [texture_px]
Needs Pillow. Uses no other third-party package.
"""
import json
import struct
import sys
from io import BytesIO

from PIL import Image

GLB_MAGIC = 0x46546C67
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def read_glb(path):
    data = open(path, "rb").read()
    magic, _version, length = struct.unpack_from("<III", data, 0)
    if magic != GLB_MAGIC:
        raise ValueError(f"{path} is not a GLB")
    off, doc, binc = 12, None, b""
    while off < length:
        clen, ctype = struct.unpack_from("<II", data, off)
        chunk = data[off + 8 : off + 8 + clen]
        if ctype == JSON_CHUNK:
            doc = json.loads(chunk)
        elif ctype == BIN_CHUNK:
            binc = chunk
        off += 8 + clen
    return doc, binc


def write_glb(path, doc, binc):
    js = json.dumps(doc, separators=(",", ":")).encode("utf8")
    js += b" " * (-len(js) % 4)
    binc += b"\0" * (-len(binc) % 4)
    total = 12 + 8 + len(js) + 8 + len(binc)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", GLB_MAGIC, 2, total))
        f.write(struct.pack("<II", len(js), JSON_CHUNK) + js)
        f.write(struct.pack("<II", len(binc), BIN_CHUNK) + binc)


def view_bytes(doc, binc, index):
    bv = doc["bufferViews"][index]
    start = bv.get("byteOffset", 0)
    return binc[start : start + bv["byteLength"]]


def main(src, out, size=2048):
    doc, binc = read_glb(src)

    # the show poses the skeleton itself, so the clips only cost download time
    doc.pop("animations", None)

    for mat in doc.get("materials", []):
        mat.pop("emissiveTexture", None)
        mat["emissiveFactor"] = [0, 0, 0]
        mat.pop("extensions", None)
        pbr = mat.setdefault("pbrMetallicRoughness", {})
        # glTF defaults metalness to 1; these are clothes and skin
        pbr["metallicFactor"] = 0.0
        pbr["roughnessFactor"] = 0.82
    for key in ("extensionsUsed", "extensionsRequired"):
        if key in doc:
            doc[key] = [e for e in doc[key] if e not in ("KHR_materials_specular", "KHR_materials_ior")]
            if not doc[key]:
                doc.pop(key)

    # new image bytes, keyed by bufferView
    replaced = {}
    for img in doc.get("images", []):
        im = Image.open(BytesIO(view_bytes(doc, binc, img["bufferView"]))).convert("RGB")
        if im.width > size:
            im = im.resize((size, size * im.height // im.width), Image.LANCZOS)
        buf = BytesIO()
        im.save(buf, "JPEG", quality=88, optimize=True, progressive=False)
        replaced[img["bufferView"]] = buf.getvalue()
        img["mimeType"] = "image/jpeg"

    # keep only the buffer views something still points at
    used = set(replaced)
    for acc in doc.get("accessors", []):
        acc["_used"] = False
    def mark(i):
        doc["accessors"][i]["_used"] = True
    for mesh in doc.get("meshes", []):
        for prim in mesh["primitives"]:
            for i in prim["attributes"].values():
                mark(i)
            if "indices" in prim:
                mark(prim["indices"])
            for target in prim.get("targets", []):
                for i in target.values():
                    mark(i)
    for skin in doc.get("skins", []):
        if "inverseBindMatrices" in skin:
            mark(skin["inverseBindMatrices"])
    for acc in doc.get("accessors", []):
        if acc["_used"] and "bufferView" in acc:
            used.add(acc["bufferView"])

    remap, views, blob = {}, [], bytearray()
    for i, bv in enumerate(doc["bufferViews"]):
        if i not in used:
            continue
        data = replaced.get(i) or view_bytes(doc, binc, i)
        blob += b"\0" * (-len(blob) % 4)
        nbv = {k: v for k, v in bv.items() if k not in ("byteOffset", "byteLength")}
        nbv.update(buffer=0, byteOffset=len(blob), byteLength=len(data))
        remap[i] = len(views)
        views.append(nbv)
        blob += data

    # drop unused accessors and renumber the ones that stay
    acc_remap, accessors = {}, []
    for i, acc in enumerate(doc.get("accessors", [])):
        if acc.pop("_used"):
            if "bufferView" in acc:
                acc["bufferView"] = remap[acc["bufferView"]]
            acc_remap[i] = len(accessors)
            accessors.append(acc)
    doc["accessors"] = accessors
    for mesh in doc.get("meshes", []):
        for prim in mesh["primitives"]:
            prim["attributes"] = {k: acc_remap[v] for k, v in prim["attributes"].items()}
            if "indices" in prim:
                prim["indices"] = acc_remap[prim["indices"]]
            if "targets" in prim:
                prim["targets"] = [{k: acc_remap[v] for k, v in t.items()} for t in prim["targets"]]
    for skin in doc.get("skins", []):
        if "inverseBindMatrices" in skin:
            skin["inverseBindMatrices"] = acc_remap[skin["inverseBindMatrices"]]
    for img in doc.get("images", []):
        img["bufferView"] = remap[img["bufferView"]]

    doc["bufferViews"] = views
    doc["buffers"] = [{"byteLength": len(blob)}]
    write_glb(out, doc, bytes(blob))
    print(f"{src} -> {out}: {len(binc) // 1024} KB -> {len(blob) // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 2048)
