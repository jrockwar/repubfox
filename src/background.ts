import { pageCapture } from "./capture";
import { getOptions } from "./options";
import { render } from "./render";
import { getTab } from "./status";
import { upload } from "./upload";
import { safeFilename, sleep } from "./utils";

/**
 * create and upload epub
 */
async function rePub(tabId: number) {
  console.log('[background] Starting rePub for tab', tabId);
  // get active state for clearing badge with navigation
  const tab = getTab(tabId);
  try {
    await tab.init();
    console.log('[background] Tab initialized');

    const { deviceToken, outputStyle, downloadAsk, ...opts } =
      await getOptions();
    await tab.progress(25);
    console.log('[background] Got options', { outputStyle });

    console.log('[background] Starting page capture');
    const mhtml = await pageCapture(tabId);
    await tab.progress(50);
    console.log('[background] Page captured successfully');

    console.log('[background] Starting render');
    const { epub, title = "missing title" } = await render(mhtml, opts);
    await tab.progress(75);
    console.log('[background] Render completed', { title });

    // upload
    if (outputStyle === "download") {
      console.log('[background] Starting download');
      await downloadEpub(tabId, safeFilename(title), new Uint8Array(epub), downloadAsk);
      console.log('[background] Download completed');
    } else if (deviceToken) {
      console.log('[background] Starting upload');
      await upload(epub, title, deviceToken);
      console.log('[background] Upload completed');
    } else {
      console.log('[background] No device token, opening options page');
      void browser.runtime.openOptionsPage();
      await Promise.reject(
        new Error(
          "must be authenticated to upload documents to reMarkable",
        )
      );
    }

    await tab.complete(outputStyle === "download" ? "done" : "sent");
    console.log('[background] Tab completed');
  } catch (ex) {
    console.error('[background] Error occurred:', ex);
    const msg = ex instanceof Error ? ex.toString() : "unknown error";
    await browser.notifications.create({
      type: "basic",
      iconUrl: "images/repub_128.png",
      title: "Conversion to epub failed",
      message: msg,
    });
    await tab.error();
    throw ex;
  } finally {
    // handle clearing the bad if we've navigated

    // NOTE leave progress around to see
    await sleep(500);
    await tab.drop();
    console.log('[background] Tab dropped');
  }
}

async function downloadEpub(
  tabId: number,
  filename: string,
  data: Uint8Array,
  saveAs: boolean = true,
): Promise<void> {
  console.log('[background] Starting downloadEpub');
  const blob = new Blob([data], { type: "application/epub+zip" });
  const url = URL.createObjectURL(blob);
  try {
    await browser.downloads.download({
      url,
      filename: `${filename}.epub`,
      saveAs,
    });
  } finally {
    URL.revokeObjectURL(url);
    console.log('[background] DownloadEpub completed');
  }
}

// watch for clicks
browser.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    console.log('[background] Starting rePub from action click');
    void rePub(tab.id);
  }
});
