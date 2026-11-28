// Records the screen with the browser's own screen capture. The browser asks the
// person what to share (this tab, a window or a screen) and shows its own
// "sharing" indicator; nothing here can record without that.

export type ActiveRecording = {
  /** Ends the recording. `done` then resolves with the video. */
  stop: () => void;
  done: Promise<Blob>;
};

export const canRecord = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
  typeof MediaRecorder !== "undefined";

const MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

const pickMimeType = () => MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));

export const videoExtension = (blob: Blob) => (blob.type.includes("mp4") ? "mp4" : "webm");

/**
 * Asks to share the screen and starts recording it. Rejects when the person
 * dismisses the browser's prompt. Ends when `stop` is called or when they stop
 * sharing from the browser's own indicator.
 */
export async function startRecording(): Promise<ActiveRecording> {
  // `preferCurrentTab` and the like are Chromium hints; other browsers ignore them
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
  } as DisplayMediaStreamOptions);

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" }));
    };
  });

  const stop = () => {
    if (recorder.state !== "inactive") recorder.stop();
  };
  // "Stop sharing" in the browser's own bar
  stream.getVideoTracks()[0]?.addEventListener("ended", stop);

  recorder.start(1_000);
  return { stop, done };
}
