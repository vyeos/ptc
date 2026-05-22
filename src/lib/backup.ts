import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getSetting, setSetting } from "./queries";

export type BackupFrequency = "daily" | "weekly" | "monthly";

const FREQUENCY_MS: Record<BackupFrequency, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export async function pickBackupFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false });
  return selected as string | null;
}

export async function performBackup(destFolder: string): Promise<string> {
  const result = await invoke<string>("backup_database", {
    destFolder,
  });
  await setSetting("last_backup", new Date().toISOString());
  return result;
}

export async function shouldBackup(): Promise<boolean> {
  const folder = await getSetting("backup_folder");
  if (!folder) return false;

  const lastBackup = await getSetting("last_backup");
  if (!lastBackup) return true;

  const frequency =
    ((await getSetting("backup_frequency")) as BackupFrequency) || "weekly";
  const elapsed = Date.now() - new Date(lastBackup).getTime();
  return elapsed >= FREQUENCY_MS[frequency];
}

export async function checkAndBackup(): Promise<boolean> {
  const due = await shouldBackup();
  if (!due) return false;

  const folder = await getSetting("backup_folder");
  if (!folder) return false;

  await performBackup(folder);
  return true;
}
