import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const FOLDER_NAME = "TikowikoCarWash";

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
