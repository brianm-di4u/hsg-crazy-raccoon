# Crazy Raccoon: procedural cartoon alligators and Bandit the raccoon, rendered to sprite sheets.
#
#   "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python art-src/blender/sprites.py -- [--only gator-paddler,raccoon] [--preview]
#
# Writes art-src/sprites/<sheet>.png and art-src/sprites/sheets.json (frame layout, anchors, px per tile).
# Look: chunky outlined toon shapes (inverted-hull Solidify outline + soft ramp + rim light), after the
# toon() material in games/farm-sim/art-src/blender/characters.py (Hot Springs Games, MIT), with outlines added.
# Units: 1 = one board tile. Camera: orthographic, looking north (+Y) down at 53 degrees, matching the game's
# 0.8 row foreshortening (sin 53 ~ 0.8). Gators face +X (nose at the origin, body toward -X; the game mirrors
# them for leftward lanes) with the waterline at z = 0. Bandit stands at the origin, facing -Y (toward camera).
# Deterministic: factory startup, no randomness.
import bpy, math, os, sys, json
import numpy as np
from mathutils import Vector, Euler
from bpy_extras.object_utils import world_to_camera_view

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'sprites'))
TMP = os.path.join(HERE, 'renders')
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ONLY = None
if '--only' in argv: ONLY = set(argv[argv.index('--only') + 1].split(','))
PREVIEW = '--preview' in argv
TILE = 128  # px per tile in the sheets
ELEV = 53.0
REF = '--ref' in argv  # pose references for the Codex paint-over: lower camera, clay grey, no sheets
if REF: ELEV, TILE = 28.0, 256

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
try: scene.eevee.taa_render_samples = 16
except Exception: pass
scene.world = bpy.data.worlds.new('W'); scene.world.color = (0.5, 0.5, 0.5)
COLL = scene.collection

def hexc(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)  # sRGB → linear

# ------------------------------------------------------------------ materials
MATS = {}
def toon(name, col, col2=None, zr=(0.0, 0.3), rim=0.35, emit=False):
    """Soft cartoon shading: diffuse → shader-to-RGB → eased ramp × colour, plus a fresnel rim light.
    col2 (optional): belly colour blended in by object-space z between zr[0] (belly) and zr[1] (back)."""
    key = (name,)
    if key in MATS: return MATS[key]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear(); N = nt.nodes.new; L = nt.links.new
    out = N('ShaderNodeOutputMaterial'); em = N('ShaderNodeEmission'); L(em.outputs[0], out.inputs[0])
    if emit:
        em.inputs['Color'].default_value = (*hexc(col), 1); MATS[key] = m; return m
    d = N('ShaderNodeBsdfDiffuse'); s2r = N('ShaderNodeShaderToRGB'); bw = N('ShaderNodeRGBToBW'); ramp = N('ShaderNodeValToRGB')
    cr = ramp.color_ramp; cr.interpolation = 'EASE'
    cr.elements[0].position = 0.0; cr.elements[0].color = (0.52, 0.52, 0.56, 1)
    cr.elements[1].position = 0.55; cr.elements[1].color = (0.9, 0.9, 0.9, 1)
    e = cr.elements.new(1.0); e.color = (1.12, 1.1, 1.05, 1)
    L(d.outputs[0], s2r.inputs[0]); L(s2r.outputs['Color'], bw.inputs[0]); L(bw.outputs[0], ramp.inputs[0])
    base = N('ShaderNodeRGB'); base.outputs[0].default_value = (*hexc(col), 1)
    colsock = base.outputs[0]
    if col2:
        tc = N('ShaderNodeTexCoord'); sep = N('ShaderNodeSeparateXYZ'); mr = N('ShaderNodeMapRange')
        mr.inputs['From Min'].default_value = zr[0]; mr.inputs['From Max'].default_value = zr[1]
        b2 = N('ShaderNodeRGB'); b2.outputs[0].default_value = (*hexc(col2), 1)
        mx = N('ShaderNodeMix'); mx.data_type = 'RGBA'
        L(tc.outputs['Object'], sep.inputs[0]); L(sep.outputs['Z'], mr.inputs['Value']); L(mr.outputs['Result'], mx.inputs['Factor'])
        L(b2.outputs[0], mx.inputs['A']); L(base.outputs[0], mx.inputs['B']); colsock = mx.outputs['Result']
    mul = N('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1.0
    L(ramp.outputs['Color'], mul.inputs['A']); L(colsock, mul.inputs['B'])
    lw = N('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.35
    rr = N('ShaderNodeValToRGB'); rr.color_ramp.elements[0].position = 0.55; rr.color_ramp.elements[0].color = (0, 0, 0, 1); rr.color_ramp.elements[1].position = 0.9; rr.color_ramp.elements[1].color = (rim, rim, rim, 1)
    L(lw.outputs['Facing'], rr.inputs[0])
    add = N('ShaderNodeMix'); add.data_type = 'RGBA'; add.blend_type = 'ADD'; add.inputs['Factor'].default_value = 1.0
    L(mul.outputs['Result'], add.inputs['A']); L(rr.outputs['Color'], add.inputs['B'])
    L(add.outputs['Result'], em.inputs['Color'])
    MATS[key] = m
    return m

INK = toon('ink', '#1B1A17', emit=True)
INK.use_backface_culling = True
HOLD = bpy.data.materials.new('holdout'); HOLD.use_nodes = True
_hn = HOLD.node_tree; _hn.nodes.clear(); _ho = _hn.nodes.new('ShaderNodeHoldout'); _hout = _hn.nodes.new('ShaderNodeOutputMaterial'); _hn.links.new(_ho.outputs[0], _hout.inputs[0])

def outline(o, t):
    o.data.materials.append(INK)
    m = o.modifiers.new('outline', 'SOLIDIFY')
    m.thickness = t; m.offset = 1.0; m.use_flip_normals = True; m.use_rim = False; m.material_offset = len(o.data.materials) - 1

def ell(name, loc, scale, mat, parent=None, rot=(0, 0, 0), ol=0.022, seg=28):
    me = bpy.data.meshes.new(name)
    import bmesh
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(10, seg // 2), radius=1.0); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); COLL.objects.link(o)
    o.data.materials.append(mat)
    o.parent = parent; o.location = loc; o.scale = scale; o.rotation_euler = rot
    if ol: outline(o, ol / max(1e-3, min(scale)))
    return o

def cone(name, loc, r, h, mat, parent=None, rot=(0, 0, 0), ol=0.014):
    import bmesh
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r, radius2=0.0, depth=h); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); COLL.objects.link(o); o.data.materials.append(mat)
    o.parent = parent; o.location = loc; o.rotation_euler = rot
    if ol: outline(o, ol)
    return o

def torus(name, loc, R, r, mat, parent=None, rot=(0, 0, 0), scale=(1, 1, 1), ol=0.0):
    import bmesh
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    segs, rs = 32, 10
    verts = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        for j in range(rs):
            b = 2 * math.pi * j / rs
            verts.append(bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
    for i in range(segs):
        for j in range(rs):
            a = verts[i * rs + j]; b = verts[i * rs + (j + 1) % rs]; c = verts[((i + 1) % segs) * rs + (j + 1) % rs]; d = verts[((i + 1) % segs) * rs + j]
            bm.faces.new((a, b, c, d))
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); COLL.objects.link(o); o.data.materials.append(mat)
    o.parent = parent; o.location = loc; o.rotation_euler = rot; o.scale = scale
    if ol: outline(o, ol)
    return o

def empty(name, loc=(0, 0, 0), parent=None, rot=(0, 0, 0)):
    o = bpy.data.objects.new(name, None); COLL.objects.link(o); o.parent = parent; o.location = loc; o.rotation_euler = rot
    return o

def clear_scene():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0: bpy.data.meshes.remove(m)

# ------------------------------------------------------------------ lighting and camera
def setup_stage():
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.0; sun.angle = math.radians(8)
    so = bpy.data.objects.new('sun', sun); COLL.objects.link(so); so.rotation_euler = Euler((math.radians(38), math.radians(-24), math.radians(-30)))
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.sensor_fit = 'HORIZONTAL'
    co = bpy.data.objects.new('cam', cam); COLL.objects.link(co); scene.camera = co
    co.rotation_euler = Euler((math.radians(90 - ELEV), 0, 0))
    return co

def frame_camera(co, center, w_tiles, h_tiles):
    scene.render.resolution_x = int(round(w_tiles * TILE)); scene.render.resolution_y = int(round(h_tiles * TILE))
    co.data.ortho_scale = w_tiles
    d = co.rotation_euler.to_matrix() @ Vector((0, 0, -1))
    co.location = Vector(center) - d * 30
    co.data.clip_start = 0.1; co.data.clip_end = 100
    bpy.context.view_layer.update()

def anchor_px(co, p):
    v = world_to_camera_view(scene, co, Vector(p))
    return [round(v.x * scene.render.resolution_x, 1), round((1 - v.y) * scene.render.resolution_y, 1)]

def render_to(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

def assemble(frames, cols, out_png):
    imgs = []
    for f in frames:
        im = bpy.data.images.load(f); a = np.empty(im.size[0] * im.size[1] * 4, dtype=np.float32); im.pixels.foreach_get(a)
        imgs.append((im.size[0], im.size[1], a.reshape(im.size[1], im.size[0], 4))); bpy.data.images.remove(im)
    w, h = imgs[0][0], imgs[0][1]; rows = (len(imgs) + cols - 1) // cols
    sheet = np.zeros((rows * h, cols * w, 4), dtype=np.float32)
    for i, (_, _, a) in enumerate(imgs):
        r, c = divmod(i, cols)
        # blender pixel rows are bottom-up; place frame i at visual row r from the top
        y0 = (rows - 1 - r) * h
        sheet[y0:y0 + h, c * w:(c + 1) * w] = a
    out = bpy.data.images.new('sheet', cols * w, rows * h, alpha=True)
    out.pixels.foreach_set(sheet.ravel()); out.filepath_raw = out_png; out.file_format = 'PNG'; out.save()
    bpy.data.images.remove(out)
    return w, h

# ------------------------------------------------------------------ the alligator
GCOL = {
    'paddler': ('#6FA84A', '#E3E2A6', '#3F6E2C'), 'whipper': ('#7A9A3C', '#EEE0A0', '#4C6424'), 'basker': ('#8D9C55', '#E4DFAE', '#56643A'),
    'sleeper': ('#7E8E63', '#DCD9B0', '#4F5C40'), 'hatchling': ('#96C85C', '#F1F0B8', '#5E8E36'), 'boss': ('#56763F', '#C9C79A', '#2F4826'),
}

def build_gator(kind, length, jaw, swim, girth=1.0):
    """Nose at the origin, body toward -X, waterline z = 0. jaw 0..1, swim phase 0..1."""
    top, belly, dark = GCOL[kind]
    skin = toon('skin-' + kind, top, belly, zr=(-0.12 * girth, 0.12 * girth))
    darkm = toon('dark-' + kind, dark)
    white = toon('white', '#FFFFFF', rim=0.1)
    pink = toon('pink', '#D9566E')
    black = toon('black', '#151417', rim=0.25)
    gold = toon('gold', '#F2C230')
    red = toon('red', '#E2453C')
    root = empty('gator')
    g = girth
    headL = min(0.95, length * 0.33) * (1.6 if kind == 'boss' else 1.0)
    if kind == 'hatchling': headL = 0.42
    bodyL = length - headL - length * 0.33
    sway = math.sin(swim * 2 * math.pi)
    hx = -headL  # hinge at the back of the head
    # body
    ell('body', (hx - bodyL * 0.5, 0, 0.02 * g), (bodyL * 0.56, 0.3 * g, 0.17 * g), skin, root)
    # tail: tapering segments swaying side to side
    tl = length - headL - bodyL
    x = hx - bodyL; ang = 0.0
    for i in range(5):
        seg = tl / 5; r = 0.25 * g * (1 - i / 5.5)
        ang += sway * 0.12 * (i + 1) / 5
        px = x - math.cos(ang) * seg * 0.5; py = math.sin(ang) * seg * 0.5 * -1
        ell(f'tail{i}', (px, py, 0.0), (seg * 0.62, r, r * 0.62), skin, root, rot=(0, 0, -ang))
        if kind == 'whipper' and i in (1, 3):
            torus(f'band{i}', (px, py, 0.0), r * 0.98, 0.04 * g, gold, root, rot=(0, math.pi / 2, -ang), scale=(1, 1, 0.62))
        x -= math.cos(ang) * seg; ang = ang
    # scutes along the back
    n = max(3, int((bodyL + tl * 0.6) / 0.16))
    for i in range(n):
        u = i / n; px = hx - 0.08 - u * (bodyL + tl * 0.6)
        zt = 0.17 * g * (1 - u * 0.6) + 0.015
        for yy in (-0.08 * g, 0.08 * g):
            cone(f'scute{i}{yy>0}', (px, yy, zt), 0.035 * g, 0.07 * g, darkm, root, rot=(0, 0, 0), ol=0.008)
    # legs, paddling
    for i, lx in enumerate((hx - bodyL * 0.12, hx - bodyL * 0.86)):
        for side in (-1, 1):
            k = math.sin((swim + i * 0.5 + (side > 0) * 0.25) * 2 * math.pi)
            land = kind in ('basker', 'sleeper') or kind == 'hatchling'
            ly = side * (0.3 * g + (0.08 if land else 0))
            ell(f'leg{i}{side}', (lx + k * 0.06, ly, -0.1 * g if not land else -0.08 * g), (0.13 * g, 0.075 * g, 0.06 * g), skin, root, rot=(0, 0, side * 0.5))
    # head: lower jaw, mouth, upper jaw on a hinge
    hz = 0.04 * g
    ell('jawlo', (hx * 0.5, 0, hz - 0.03 * g), (headL * 0.5, 0.2 * g, 0.06 * g), skin, root)
    hinge = empty('hinge', (hx + 0.05, 0, hz + 0.02 * g), root, rot=(0, -jaw * 0.62, 0))
    open_amt = jaw
    if open_amt > 0.04:
        ell('mouth', (hx * 0.5, 0, hz + 0.02 * g), (headL * 0.44, 0.17 * g, 0.035 * g + 0.05 * open_amt * g), pink, root, ol=0.0)
        for i in range(6):  # lower teeth
            tx = hx * 0.5 - headL * 0.4 + i * headL * 0.15
            for yy in (-0.15 * g, 0.15 * g):
                cone(f'tlo{i}{yy>0}', (tx, yy, hz + 0.02 * g), 0.022 * g, 0.06 * g, white, root, ol=0.006)
    up = ell('jawup', (-hx * 0.5 - 0.05, 0, 0.03 * g), (headL * 0.52, 0.22 * g, 0.085 * g), skin, hinge)
    for i in range(6):  # upper teeth, pointing down out of the upper jaw
        tx = -hx * 0.5 - 0.05 - headL * 0.38 + i * headL * 0.15
        for yy in (-0.17 * g, 0.17 * g):
            cone(f'tup{i}{yy>0}', (tx, yy, -0.04 * g), 0.022 * g, 0.06 * g, white, hinge, rot=(math.pi, 0, 0), ol=0.006)
    for yy in (-0.05 * g, 0.05 * g):
        ell(f'nostril{yy>0}', (-hx - 0.12, yy, 0.1 * g), (0.025 * g, 0.02 * g, 0.015 * g), black, hinge, ol=0.0)
    if kind == 'hatchling':
        torus('band', (-hx * 0.55 - 0.05, 0, 0.0), 0.2, 0.025, red, hinge, rot=(0, math.pi / 2, 0), scale=(1, 1, 0.55))
    # eyes on raised bumps at the back of the head (ride with the upper jaw so they lift when it opens)
    er = (0.13 if kind == 'hatchling' else 0.11) * g
    asleep = kind == 'sleeper' and jaw < 0.05
    for side in (-1, 1):
        ey = side * 0.11 * g
        ell(f'eyebump{side}', (0.08, ey, 0.11 * g), (er * 1.15, er * 1.05, er * 0.95), skin, hinge)
        ell(f'eye{side}', (0.12, ey, 0.15 * g), (er * 0.78, er * 0.78, er * 0.8), white, hinge, ol=0.012)
        if asleep:
            ell(f'lid{side}', (0.13, ey, 0.17 * g), (er * 0.82, er * 0.82, er * 0.62), skin, hinge, ol=0.012)
        else:
            ell(f'pupil{side}', (0.17, ey * 1.05, 0.17 * g), (er * 0.3, er * 0.26, er * 0.42), black, hinge, ol=0.0)
            # brow: a dark wedge over each eye (angry when the jaws open, or always on the boss)
            mean = kind == 'boss' or jaw > 0.5
            ell(f'brow{side}', (0.12, ey, 0.25 * g), (er * 0.95, er * 0.32, er * 0.18), darkm, hinge, rot=(side * (0.5 if mean else -0.2), 0, 0), ol=0.008)
    if kind == 'boss':
        scar = toon('scar', '#E8DCB8')
        ell('scar1', (hx - 0.4, 0.12, 0.2 * g), (0.34, 0.03, 0.02), scar, root, rot=(0, 0, 0.6), ol=0.0)
        ell('scar2', (hx - 0.6, -0.06, 0.2 * g), (0.22, 0.025, 0.02), scar, root, rot=(0, 0, -0.5), ol=0.0)
    return root

KINDS = {
    # sheet: (length tiles, girth, water holdout, jaw frames, swim frames)
    'paddler': (3.0, 1.0, True, 5, 4), 'whipper': (3.0, 1.0, True, 5, 4), 'basker': (3.0, 1.05, False, 5, 4),
    'sleeper': (2.0, 1.0, False, 5, 2), 'hatchling': (1.0, 0.55, False, 1, 4), 'boss': (6.0, 1.9, True, 5, 4),
}

def render_gator(co, kind):
    length, girth, water, jaws, swims = KINDS[kind]
    margin = 0.45 * girth
    w = length + margin * 2 + 0.3
    h = 1.25 * girth + 0.55
    center = (-length / 2 + 0.1, 0, 0.12 * girth)
    frames = []
    for j in range(jaws):
        for s in range(swims):
            clear_scene(); co = setup_stage()
            build_gator(kind, length, j / max(1, jaws - 1), s / swims, girth)
            if water:
                pl = ell('water', (-length / 2, 0, -0.5), (length + 2, 3, 0.5), HOLD, ol=0.0)
                pl.scale = (length + 2, 3, 0.5); pl.location = (-length / 2, -0.0, -0.5)
            frame_camera(co, center, w, h)
            p = os.path.join(TMP, f'{kind}_{j}_{s}.png'); render_to(p); frames.append(p)
            anchor = anchor_px(co, (0, 0, 0))
    cols = swims if swims > 1 else min(5, len(frames))
    cw, ch = assemble(frames, cols, os.path.join(OUT, f'gator-{kind}.png'))
    return {'file': f'gator-{kind}.png', 'cw': cw, 'ch': ch, 'cols': cols, 'tile': TILE, 'anchor': anchor, 'jaws': jaws, 'swim': swims if swims > 1 else 0, 'frames': {}}

# ------------------------------------------------------------------ Bandit the raccoon
def build_raccoon(facing, pose):
    """pose: 0 stand, 1 launch (stretched), 2 air tuck, 3 land squat. Faces -Y at rot 0."""
    fur = toon('fur', '#A9A9B0', '#C9C9CF', zr=(0.55, 0.15))
    furd = toon('furd', '#7C7C85')
    mask = toon('mask', '#262529', rim=0.2)
    white = toon('white', '#FFFFFF', rim=0.1)
    face = toon('face', '#F2F0EA', rim=0.15)
    black = toon('black', '#151417', rim=0.25)
    pinkn = toon('nose', '#2A2226', rim=0.2)
    rot = {'down': 0, 'up': math.pi, 'left': -math.pi / 2, 'right': math.pi / 2}[facing]
    root = empty('raccoon', rot=(0, 0, rot))
    sz = [1.0, 1.12, 0.95, 0.82][pose]; sx = [1.0, 0.9, 1.04, 1.16][pose]
    lift = [0.0, 0.05, 0.12, 0.0][pose]
    body = empty('bodyrig', (0, 0, lift), root)
    ell('body', (0, 0.02, 0.33 * sz), (0.29 * sx, 0.26 * sx, 0.3 * sz), fur, body)
    ell('belly', (0, -0.14, 0.3 * sz), (0.18 * sx, 0.12, 0.2 * sz), face, body, ol=0.0)
    # head
    hz = 0.33 * sz + 0.36
    head = empty('head', (0, -0.04, hz), body, rot=([0, -0.15, 0.1, 0.08][pose], 0, 0))
    ell('skull', (0, 0, 0), (0.28, 0.25, 0.22), fur, head)
    ell('cheekL', (-0.17, -0.08, -0.06), (0.12, 0.1, 0.09), face, head, ol=0.012)
    ell('cheekR', (0.17, -0.08, -0.06), (0.12, 0.1, 0.09), face, head, ol=0.012)
    ell('snout', (0, -0.2, -0.05), (0.11, 0.1, 0.08), face, head)
    ell('nose', (0, -0.3, -0.03), (0.04, 0.035, 0.03), pinkn, head, ol=0.008)
    ell('brow', (0, -0.17, 0.08), (0.16, 0.06, 0.05), face, head, ol=0.0)
    for side in (-1, 1):
        ell(f'mask{side}', (side * 0.1, -0.18, 0.0), (0.12, 0.06, 0.075), mask, head, rot=(0, side * 0.3, 0), ol=0.0)
        ell(f'eye{side}', (side * 0.1, -0.215, 0.01), (0.055, 0.035, 0.06), white, head, ol=0.008)
        ell(f'pupil{side}', (side * 0.1, -0.245, 0.0), (0.026, 0.02, 0.034), black, head, ol=0.0)
        ell(f'ear{side}', (side * 0.19, 0.02, 0.19), (0.085, 0.045, 0.1), furd, head, rot=(0, side * 0.35, 0))
        ell(f'earin{side}', (side * 0.19, -0.02, 0.19), (0.05, 0.02, 0.065), mask, head, rot=(0, side * 0.35, 0), ol=0.0)
    # arms and feet
    ay = [0.0, 0.0, -0.08, -0.05][pose]; az = [0.0, 0.18, 0.05, -0.06][pose]
    for side in (-1, 1):
        ell(f'arm{side}', (side * 0.25, -0.12 + ay, 0.36 * sz + az), (0.07, 0.07, 0.12), furd, body, rot=(0.4 if pose == 1 else 0.9, side * 0.4, 0))
        fz = [0.04, -0.02, 0.1, 0.03][pose]; fy = [0.0, 0.06, -0.06, -0.02][pose]
        ell(f'foot{side}', (side * 0.15 * sx, -0.06 + fy, fz - lift), (0.09, 0.12, 0.05), mask, body)
    # ringed tail curling up behind
    t = empty('tail', (0, 0.22, 0.22 * sz), body, rot=([0.6, 0.9, 0.3, 0.5][pose], 0, 0))
    for i in range(6):
        r = 0.12 - i * 0.008
        ell(f'tail{i}', (0, 0.1 * i, 0.06 * i * i * 0.35), (r, 0.075, r), mask if i % 2 else fur, t, ol=0.016)
    return root

def render_raccoon(co):
    frames, names = [], {}
    order = ['up', 'down', 'left', 'right']
    for facing in order:
        for pose in range(4):
            clear_scene(); co = setup_stage()
            build_raccoon(facing, pose)
            frame_camera(co, (0, 0.05, 0.45), 1.6, 1.85)
            p = os.path.join(TMP, f'raccoon_{facing}_{pose}.png'); render_to(p)
            names[f'{facing}-{pose}'] = len(frames); frames.append(p)
            anchor = anchor_px(co, (0, 0, 0))
    cw, ch = assemble(frames, 4, os.path.join(OUT, 'raccoon.png'))
    return {'file': 'raccoon.png', 'cw': cw, 'ch': ch, 'cols': 4, 'tile': TILE, 'anchor': anchor, 'hop': 4, 'frames': names}

# ------------------------------------------------------------------ pose references (--ref)
def render_refs():
    rd = os.path.normpath(os.path.join(HERE, '..', 'ref')); os.makedirs(rd, exist_ok=True)
    jobs = [('gator-closed', 'paddler', 0.0), ('gator-open', 'paddler', 1.0), ('boss-open', 'boss', 1.0), ('hatchling', 'hatchling', 0.0)]
    for name, kind, jaw in jobs:
        length, girth, water, _, _ = KINDS[kind]
        clear_scene(); co = setup_stage(); build_gator(kind, length, jaw, 0.25, girth)
        frame_camera(co, (-length / 2 + 0.1, 0, 0.15 * girth), length + 1.2 * girth, 1.6 * girth + 0.5)
        render_to(os.path.join(rd, name + '.png'))
    for facing in ('up', 'down', 'left'):
        for pose, pn in ((0, 'stand'), (2, 'hop')):
            clear_scene(); co = setup_stage(); build_raccoon(facing, pose)
            frame_camera(co, (0, 0.05, 0.5), 1.6, 1.9)
            render_to(os.path.join(rd, f'raccoon-{facing}-{pn}.png'))
    print('@@REFS', rd)

# ------------------------------------------------------------------ main
if REF:
    render_refs(); sys.exit(0)
meta_path = os.path.join(OUT, 'sheets.json')
meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
co = setup_stage()
jobs = [f'gator-{k}' for k in KINDS] + ['raccoon']
for job in jobs:
    if ONLY and job not in ONLY: continue
    if job == 'raccoon': meta['raccoon'] = render_raccoon(co)
    else: meta[job] = render_gator(co, job[6:])
    print('@@SHEET', job, meta[job]['cw'], meta[job]['ch'], meta[job]['anchor'])
json.dump(meta, open(meta_path, 'w'), indent=1)
print('@@DONE', meta_path)
