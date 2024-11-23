interface CaptureRequest {
  type: 'capture-mhtml';
}

interface CaptureResponse {
  success: boolean;
  error?: string;
  data?: ArrayBuffer;
}

/**
 * Captures a webpage as MHTML using our custom generator
 */
export async function pageCapture(tabId: number): Promise<ArrayBuffer> {
  console.log('[capture] Starting page capture for tab', tabId);
  try {
    // Inject content script
    console.log('[capture] Injecting content script');
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['mhtml/content.js']
    });
    console.log('[capture] Content script injected');

    // Request MHTML capture
    console.log('[capture] Sending capture request to content script');
    const request: CaptureRequest = { type: 'capture-mhtml' };
    const response = (await browser.tabs.sendMessage(tabId, request)) as CaptureResponse;
    console.log('[capture] Received response from content script', { success: response.success });
    
    if (!response.success) {
      const error = response.error ?? 'MHTML capture failed';
      console.error('[capture] Capture failed:', error);
      throw new Error(error);
    }

    if (!response.data) {
      throw new Error('No data returned from capture');
    }

    console.log('[capture] Capture completed successfully');
    return response.data;
  } catch (error) {
    console.error('[capture] Page capture failed:', error);
    throw error;
  }
}
