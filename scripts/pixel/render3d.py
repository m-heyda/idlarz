"""Tiny orthographic ray-caster that turns 3D primitives into hue-shifted, outlined pixel art."""
import math
from PIL import Image


# ----------------------------------------------------------------- vector helpers
def add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def mul(a, s): return (a[0] * s, a[1] * s, a[2] * s)
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def norm(a):
    l = math.sqrt(dot(a, a)) or 1.0
    return (a[0] / l, a[1] / l, a[2] / l)


I3 = ((1, 0, 0), (0, 1, 0), (0, 0, 1))


def mv(R, v): return (dot(R[0], v), dot(R[1], v), dot(R[2], v))
def mtv(R, v): return (R[0][0] * v[0] + R[1][0] * v[1] + R[2][0] * v[2],
                       R[0][1] * v[0] + R[1][1] * v[1] + R[2][1] * v[2],
                       R[0][2] * v[0] + R[1][2] * v[1] + R[2][2] * v[2])
def mm(A, B): return tuple(tuple(sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)) for i in range(3))


def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    return ((1, 0, 0), (0, c, -s), (0, s, c))


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return ((c, 0, s), (0, 1, 0), (-s, 0, c))


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return ((c, -s, 0), (s, c, 0), (0, 0, 1))


def rot(x=0.0, y=0.0, z=0.0):
    """Euler rotation in degrees, applied x then y then z."""
    return mm(rot_z(math.radians(z)), mm(rot_y(math.radians(y)), rot_x(math.radians(x))))


def hexc(h, a=255):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


# ----------------------------------------------------------------- noise
def _h(ix, iy, iz, seed):
    h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 1442695041) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def vnoise(x, y, z, seed=0):
    ix, iy, iz = math.floor(x), math.floor(y), math.floor(z)
    fx, fy, fz = x - ix, y - iy, z - iz
    fx, fy, fz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)
    out = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (fx if dx else 1 - fx) * (fy if dy else 1 - fy) * (fz if dz else 1 - fz)
                out += w * _h(ix + dx, iy + dy, iz + dz, seed)
    return out


# ----------------------------------------------------------------- materials / primitives
class Material:
    def __init__(self, ramp, outline, spec=0.0, shiny=24, grain=0.0, grain_scale=3.0, spec_col=None, gamma=1.0, gain=1.0):
        self.ramp = [hexc(c) for c in ramp]       # dark -> light
        self.outline = hexc(outline)
        self.spec, self.shiny, self.gamma, self.gain = spec, shiny, gamma, gain
        self.grain, self.grain_scale = grain, grain_scale
        self.spec_col = hexc(spec_col) if spec_col else self.ramp[-1]


class Prim:
    """kind: 'box' size=(hx,hy,hz) | 'ell' size=(a,b,c) | 'cyl' size=(radius, half_length) (axis = local z)
    | 'cone' size=(base_radius, half_height) (apex up).
    tex(p_local, n_local, prim) -> (material_name_or_None, delta_intensity)."""

    def __init__(self, kind, center, size, mat, R=I3, tex=None, seed=0):
        self.kind, self.c, self.s, self.mat, self.R, self.tex, self.seed = kind, center, size, mat, R, tex, seed
        # conservative bounding sphere: a ray (unit direction) that misses it cannot hit the primitive
        self.rad2 = sum(v * v for v in size) if kind in ('box', 'ell') else size[0] ** 2 + size[1] ** 2

    def hit(self, o, d):
        w = (self.c[0] - o[0], self.c[1] - o[1], self.c[2] - o[2])
        along = w[0] * d[0] + w[1] * d[1] + w[2] * d[2]
        if w[0] * w[0] + w[1] * w[1] + w[2] * w[2] - along * along > self.rad2 + 1e-6:
            return None
        ol = mtv(self.R, sub(o, self.c))
        dl = mtv(self.R, d)
        res = None
        if self.kind == 'ell':
            s = self.s
            o2 = (ol[0] / s[0], ol[1] / s[1], ol[2] / s[2])
            d2 = (dl[0] / s[0], dl[1] / s[1], dl[2] / s[2])
            A, B, C = dot(d2, d2), dot(o2, d2), dot(o2, o2) - 1
            disc = B * B - A * C
            if disc < 0:
                return None
            t = (-B - math.sqrt(disc)) / A
            if t < 1e-4:
                return None
            p = add(ol, mul(dl, t))
            nl = norm((p[0] / s[0] ** 2, p[1] / s[1] ** 2, p[2] / s[2] ** 2))
            res = (t, nl, p)
        elif self.kind == 'box':
            s = self.s
            tmin, tmax, axis, sgn = -1e9, 1e9, 0, 1
            for i in range(3):
                if abs(dl[i]) < 1e-9:
                    if abs(ol[i]) > s[i]:
                        return None
                    continue
                t1, t2 = (-s[i] - ol[i]) / dl[i], (s[i] - ol[i]) / dl[i]
                sg = -1 if dl[i] > 0 else 1
                if t1 > t2:
                    t1, t2 = t2, t1
                if t1 > tmin:
                    tmin, axis, sgn = t1, i, sg
                tmax = min(tmax, t2)
            if tmin > tmax or tmin < 1e-4:
                return None
            nl = [0, 0, 0]
            nl[axis] = sgn
            res = (tmin, tuple(nl), add(ol, mul(dl, tmin)))
        elif self.kind == 'cyl':
            r, h = self.s
            best = None
            A = dl[0] ** 2 + dl[1] ** 2
            if A > 1e-12:
                B = ol[0] * dl[0] + ol[1] * dl[1]
                C = ol[0] ** 2 + ol[1] ** 2 - r * r
                disc = B * B - A * C
                if disc >= 0:
                    sq = math.sqrt(disc)
                    for t in ((-B - sq) / A, (-B + sq) / A):
                        if t > 1e-4:
                            z = ol[2] + dl[2] * t
                            if abs(z) <= h:
                                p = add(ol, mul(dl, t))
                                best = (t, norm((p[0], p[1], 0)), p)
                                break
            if abs(dl[2]) > 1e-9:
                for sg in (1, -1):
                    t = (sg * h - ol[2]) / dl[2]
                    if t > 1e-4 and (best is None or t < best[0]):
                        p = add(ol, mul(dl, t))
                        if p[0] ** 2 + p[1] ** 2 <= r * r:
                            best = (t, (0, 0, sg), p)
            res = best
        elif self.kind == 'cone':
            r, h = self.s                      # base radius r at z=-h, apex at z=+h
            k = r / (2.0 * h)
            ox, oy, oz = ol
            dx, dy, dz = dl
            best = None
            A = dx * dx + dy * dy - k * k * dz * dz
            B = ox * dx + oy * dy + k * k * (h - oz) * dz
            C = ox * ox + oy * oy - k * k * (h - oz) ** 2
            roots = []
            if abs(A) > 1e-12:
                disc = B * B - A * C
                if disc >= 0:
                    sq = math.sqrt(disc)
                    roots = [(-B - sq) / A, (-B + sq) / A]
            elif abs(B) > 1e-12:
                roots = [-C / (2 * B)]
            for t in sorted(roots):
                if t > 1e-4:
                    z = oz + dz * t
                    if -h <= z <= h:
                        p = add(ol, mul(dl, t))
                        best = (t, norm((p[0], p[1], k * k * (h - p[2]))), p)
                        break
            if abs(dz) > 1e-9:                 # flat base
                t = (-h - oz) / dz
                if t > 1e-4 and (best is None or t < best[0]):
                    p = add(ol, mul(dl, t))
                    if p[0] ** 2 + p[1] ** 2 <= r * r:
                        best = (t, (0, 0, -1), p)
            res = best
        if res is None:
            return None
        t, nl, p = res
        return t, mv(self.R, nl), nl, p


DEFAULTS = {'rim': False, 'dither': 0.3}

BAYER = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))


class Scene:
    def __init__(self, materials, size=40, scale=13.0, yaw=45.0, pitch=30.0, origin=(20, 22),
                 light=(-0.45, 0.65, 0.6), ambient=0.28, shadows=True, rim=None, dither=None):
        self.mats, self.scale, self.origin = materials, scale, origin
        self.w, self.h = (size, size) if isinstance(size, int) else size
        self.prims = []
        th, ph = math.radians(yaw), math.radians(pitch)
        self.f = norm((math.sin(th) * math.cos(ph), math.cos(th) * math.cos(ph), -math.sin(ph)))
        r = norm((self.f[1], -self.f[0], 0))
        self.r = r
        self.u = norm(cross(r, self.f))
        L = add(add(mul(r, light[0]), mul(self.u, light[1])), mul(self.f, -light[2]))
        self.L = norm(L)
        self.H = norm(add(self.L, mul(self.f, -1)))
        self.ambient, self.shadows = ambient, shadows
        self.rim = DEFAULTS['rim'] if rim is None else rim
        self.dither = DEFAULTS['dither'] if dither is None else dither

    def add(self, *prims):
        self.prims.extend(prims)

    # -------------------------------------------------------------- render
    def _cast(self, o, d):
        best = None
        for pid, pr in enumerate(self.prims):
            h = pr.hit(o, d)
            if h and (best is None or h[0] < best[0]):
                best = (h[0], pid) + h[1:]
        return best

    def render(self, outline=True, contour=True):
        buf = {}
        for iy in range(self.h):
            for ix in range(self.w):
                sx = (ix + 0.5 - self.origin[0]) / self.scale
                sy = (self.origin[1] - (iy + 0.5)) / self.scale
                o = add(add(mul(self.r, sx), mul(self.u, sy)), mul(self.f, -60))
                h = self._cast(o, self.f)
                if not h:
                    continue
                t, pid, nw, nl, pl = h
                buf[(ix, iy)] = (t, pid) + self._shade(self.prims[pid], o, t, nw, nl, pl, ix, iy)
        img = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        for (x, y), v in buf.items():
            img.putpixel((x, y), v[2])
        if contour:
            self._contours(img, buf)
        if self.rim:
            self._rim(img, buf)
        if outline:
            self._outline(img, buf)
        return img

    def _shade(self, pr, o, t, nw, nl, pl, ix, iy):
        mat_name = pr.mat
        dI = 0.0
        if pr.tex:
            m2, dI = pr.tex(pl, nl, pr)
            if m2:
                mat_name = m2
        m = self.mats[mat_name]
        I = self.ambient + (1 - self.ambient) * max(0.0, dot(nw, self.L))
        if m.grain:
            g = vnoise(pl[0] * m.grain_scale, pl[1] * m.grain_scale, pl[2] * m.grain_scale, pr.seed) - 0.5
            dI += g * m.grain
        p = add(o, mul(self.f, t))
        if self.shadows and dot(nw, self.L) > 0:
            q = add(p, mul(nw, 0.02))
            for pid2, other in enumerate(self.prims):
                if other is pr:
                    continue
                if other.hit(q, self.L):
                    I *= 0.62
                    break
        I = (max(0.0, min(1.0, I + dI)) ** m.gamma) * m.gain
        k = len(m.ramp)
        v = I * k + (BAYER[iy % 4][ix % 4] / 16.0 - 0.5) * self.dither
        idx = max(0, min(k - 1, int(v)))
        col = m.ramp[idx]
        if m.spec:
            s = max(0.0, dot(nw, self.H)) ** m.shiny
            if s > 1 - m.spec:
                col, idx = m.spec_col, k - 1
        return (col, mat_name, idx)

    def _contours(self, img, buf):
        out = img.copy()
        for (x, y), v in buf.items():
            for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1)):
                q = buf.get((x + dx, y + dy))
                if q and q[1] != v[1] and v[0] - q[0] > 0.12:      # neighbour is in front of us
                    out.putpixel((x, y), self.mats[v[3]].ramp[0])
                    break
        img.paste(out)

    def _rim(self, img, buf):
        """Lit-edge rim light: silhouette pixels facing the light step up one ramp tone."""
        for (x, y), v in buf.items():
            if (x, y - 1) in buf and (x - 1, y) in buf:
                continue
            m = self.mats[v[3]]
            if v[4] >= 1:
                img.putpixel((x, y), m.ramp[min(len(m.ramp) - 1, v[4] + 1)])

    def _outline(self, img, buf):
        for y in range(self.h):
            for x in range(self.w):
                if (x, y) in buf:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = buf.get((x + dx, y + dy))
                    if q:
                        img.putpixel((x, y), self.mats[q[3]].outline)
                        break


# ----------------------------------------------------------------- placement helpers
def frame(axis, hint=(0, 0, 1)):
    """Rotation whose local z = axis and local y points as close to `hint` as possible."""
    z = norm(axis)
    y = sub(hint, mul(z, dot(hint, z)))
    if dot(y, y) < 1e-6:
        y = sub((1, 0, 0), mul(z, z[0]))
    y = norm(y)
    x = cross(y, z)
    return ((x[0], y[0], z[0]), (x[1], y[1], z[1]), (x[2], y[2], z[2]))


def between(kind, p0, p1, radii, mat, tex=None, hint=(0, 0, 1), seed=0):
    """Cylinder/box whose local z runs from p0 to p1. radii = (r, ) for cyl or (hx, hy) for box."""
    axis = sub(p1, p0)
    L = math.sqrt(dot(axis, axis))
    c = mul(add(p0, p1), 0.5)
    R = frame(axis, hint)
    size = (radii[0], L / 2) if kind == 'cyl' else (radii[0], radii[1], L / 2)
    return Prim(kind, c, size, mat, R, tex, seed)


def place(prim, yaw_deg):
    """Rotate a prim about the world z axis (used to turn a whole figure toward the camera)."""
    Rz = rot_z(math.radians(yaw_deg))
    prim.c = mv(Rz, prim.c)
    prim.R = mm(Rz, prim.R)
    return prim
