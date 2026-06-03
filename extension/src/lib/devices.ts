/**
 * Media device enumeration for the mic/camera dropdowns. Labels are only available
 * once the user has granted the relevant permission; until then we fall back to
 * generic names so the dropdowns still render.
 */
export interface DeviceOption {
  deviceId: string;
  label: string;
}

export interface Devices {
  mics: DeviceOption[];
  cameras: DeviceOption[];
}

export async function listDevices(): Promise<Devices> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    const mics = all
      .filter((d) => d.kind === "audioinput")
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
    const cameras = all
      .filter((d) => d.kind === "videoinput")
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
    return { mics, cameras };
  } catch {
    return { mics: [], cameras: [] };
  }
}
