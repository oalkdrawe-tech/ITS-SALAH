import { getStore } from "@netlify/blobs";

const PASS = () => Netlify.env.get("ADMIN_PASSWORD") || "salah2011ss";
const J = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const p = new URL(req.url).pathname.replace(/^\/api\/?/, "");
  const site = getStore("site");
  const imgs = getStore("img");
  const authed = () => req.headers.get("x-admin") === PASS();

  if (p === "state" && req.method === "GET")
    return J((await site.get("state", { type: "json" })) || {});

  if (p === "login" && req.method === "POST")
    return authed() ? J({ ok: 1 }) : J({ e: "auth" }, 401);

  if (p === "state" && req.method === "POST") {
    if (!authed()) return J({ e: "auth" }, 401);
    const txt = await req.text();
    if (txt.length > 500000) return J({ e: "too_large" }, 413);
    let b;
    try { b = JSON.parse(txt); } catch { return J({ e: "bad" }, 400); }
    if (!b || typeof b !== "object" || Array.isArray(b)) return J({ e: "bad" }, 400);
    await site.setJSON("state", b);
    return J({ ok: 1 });
  }

  if (p === "img" && req.method === "POST") {
    if (!authed()) return J({ e: "auth" }, 401);
    const body = await req.text();
    const m = body.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return J({ e: "bad" }, 400);
    const id = crypto.randomUUID();
    await imgs.set(id, Buffer.from(m[2], "base64"), { metadata: { type: m[1] } });
    return J({ url: "/api/img/" + id });
  }

  if (p.startsWith("img/") && req.method === "GET") {
    const r = await imgs.getWithMetadata(p.slice(4), { type: "arrayBuffer" });
    if (!r) return new Response("Not found", { status: 404 });
    return new Response(r.data, {
      headers: {
        "content-type": r.metadata?.type || "image/jpeg",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  return J({ e: "not_found" }, 404);
};

export const config = { path: "/api/*" };
