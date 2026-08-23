import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const FOLDER_NAME = "TikowikoCity";

type SaveInput = { fileName: string; payload: unknown };

function headers() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const driveKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !driveKey) {
    throw new Error("Connexion Google Drive indisponible.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": driveKey,
  };
}

async function ensureFolder(h: Record<string, string>): Promise<string> {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const found = await fetch(`${GATEWAY}/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: h,
  });
  if (!found.ok) {
    const body = await found.text();
    throw new Error(`Drive [${found.status}]: ${body}`);
  }
  const data = (await found.json()) as { files?: Array<{ id: string }> };
  const existing = data.files?.[0]?.id;
  if (existing) return existing;

  const created = await fetch(`${GATEWAY}/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!created.ok) {
    const body = await created.text();
    throw new Error(`Drive [${created.status}]: ${body}`);
  }
  return ((await created.json()) as { id: string }).id;
}

export const saveToDrive = createServerFn({ method: "POST" })
  .inputValidator((input: SaveInput) => {
    if (!input || typeof input.fileName !== "string" || input.fileName.length > 120) {
      throw new Error("Nom de fichier invalide.");
    }
    return { fileName: input.fileName.replace(/[/\\]/g, "-"), payload: input.payload };
  })
  .handler(async ({ data }) => {
    const h = headers();
    const folderId = await ensureFolder(h);

    const boundary = `tkw${Math.random().toString(36).slice(2)}`;
    const meta = JSON.stringify({
      name: data.fileName,
      parents: [folderId],
      mimeType: "application/json",
    });
    const content = JSON.stringify(data.payload, null, 2);
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n` +
      `--${boundary}--`;

    const res = await fetch(
      `${GATEWAY}/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`,
      {
        method: "POST",
        headers: { ...h, "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Drive upload failed [${res.status}]: ${errorBody}`);
      throw new Error(`Échec de l'envoi vers Drive [${res.status}]`);
    }
    return (await res.json()) as { id: string; name: string; webViewLink?: string };
  });

export type SaveEnvelope = {
  version: number;
  app: "TikowikoCity";
  savedAt: string;
  state: Record<string, unknown>;
};

export const loadFromDrive = createServerFn({ method: "POST" }).handler(async () => {
  const h = headers();
  const folderQ = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const folderRes = await fetch(`${GATEWAY}/drive/v3/files?q=${folderQ}&fields=files(id)`, {
    headers: h,
  });
  if (!folderRes.ok) {
    const body = await folderRes.text();
    console.error(`Drive folder lookup failed [${folderRes.status}]: ${body}`);
    throw new Error(`Échec de la lecture Drive [${folderRes.status}]`);
  }
  const folderId = ((await folderRes.json()) as { files?: Array<{ id: string }> }).files?.[0]?.id;
  if (!folderId) return { found: false as const };

  const listQ = encodeURIComponent(
    `'${folderId}' in parents and name contains 'tikowiko' and trashed=false`,
  );
  const listRes = await fetch(
    `${GATEWAY}/drive/v3/files?q=${listQ}&orderBy=createdTime desc&pageSize=10&fields=files(id,name,createdTime)`,
    { headers: h },
  );
  if (!listRes.ok) {
    const body = await listRes.text();
    console.error(`Drive list failed [${listRes.status}]: ${body}`);
    throw new Error(`Échec de la lecture Drive [${listRes.status}]`);
  }
  const files = ((await listRes.json()) as {
    files?: Array<{ id: string; name: string }>;
  }).files?.filter((f) => f.name.endsWith(".json"));
  const latest = files?.[0];
  if (!latest) return { found: false as const };

  const contentRes = await fetch(`${GATEWAY}/drive/v3/files/${latest.id}?alt=media`, {
    headers: h,
  });
  if (!contentRes.ok) {
    const body = await contentRes.text();
    console.error(`Drive download failed [${contentRes.status}]: ${body}`);
    throw new Error(`Échec de la lecture Drive [${contentRes.status}]`);
  }
  const raw = await contentRes.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Sauvegarde illisible (JSON invalide).");
  }
  const obj = parsed as Partial<SaveEnvelope> & { machines?: unknown; cinema?: unknown };
  if (obj?.app !== "TikowikoCity" && obj?.app !== "TikowikoCarWash") {
    throw new Error("Ce fichier n'est pas une sauvegarde TikowikoCity.");
  }
  // v0 saves stored fields at the root; normalize to the versioned envelope.
  const state =
    obj.state && typeof obj.state === "object"
      ? (obj.state as Record<string, unknown>)
      : { machines: obj.machines, cinema: obj.cinema };

  return {
    found: true as const,
    fileName: latest.name,
    version: typeof obj.version === "number" ? obj.version : 0,
    savedAt: typeof obj.savedAt === "string" ? obj.savedAt : null,
    // Serialized so future fields travel unchanged through the RPC boundary.
    stateJson: JSON.stringify(state ?? {}),
  };
});
